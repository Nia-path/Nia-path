-- =============================================================================
-- MIGRATION 009: FEATURE EXTENSIONS
-- Extends existing schema for:
--   1. AI Risk Detection (ai_messages, ai_conversations)
--   2. Silent Distress Mode (emergency_sessions)
--   3. Emergency Location Sharing (new: emergency_locations)
--   4. Evidence Verification Metadata (evidence)
--   5. Nearby Help Routing (help_services geospatial + new: service_searches)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FEATURE 1: AI RISK DETECTION
-- Extends ai_messages with structured risk classification fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS risk_level      TEXT
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS risk_score      NUMERIC(4,3)   -- 0.000 – 1.000
    CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 1)),
  ADD COLUMN IF NOT EXISTS risk_category   TEXT
    CHECK (risk_category IN (
      'domestic_violence',
      'sexual_violence',
      'stalking',
      'financial_coercion',
      'child_at_risk',
      'suicidal_ideation',
      'property_threat',
      'workplace_threat',
      'general_distress',
      'none'
    )),
  ADD COLUMN IF NOT EXISTS risk_flags      TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS risk_assessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at   TIMESTAMPTZ,   -- when n8n picked it up
  ADD COLUMN IF NOT EXISTS escalation_workflow_id TEXT;   -- n8n execution ID

-- Extend ai_conversations to surface aggregated risk
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS max_risk_level      TEXT
    CHECK (max_risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS max_risk_score      NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS risk_escalated      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_escalated_at   TIMESTAMPTZ;

-- Index for n8n to find unprocessed high-risk messages
CREATE INDEX IF NOT EXISTS idx_ai_messages_high_risk
  ON ai_messages (risk_level, escalated_at)
  WHERE risk_level IN ('high', 'critical') AND escalated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_messages_risk_score
  ON ai_messages (risk_score DESC)
  WHERE risk_score IS NOT NULL;

-- Trigger: keep conversation max_risk_level in sync
CREATE OR REPLACE FUNCTION sync_conversation_risk()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.risk_level IS NOT NULL AND NEW.role = 'assistant' THEN
    UPDATE ai_conversations
    SET
      max_risk_level = CASE
        WHEN max_risk_level IS NULL THEN NEW.risk_level
        WHEN NEW.risk_level = 'critical' THEN 'critical'
        WHEN NEW.risk_level = 'high' AND max_risk_level != 'critical' THEN 'high'
        WHEN NEW.risk_level = 'medium'
          AND max_risk_level NOT IN ('high', 'critical') THEN 'medium'
        ELSE max_risk_level
      END,
      max_risk_score = GREATEST(COALESCE(max_risk_score, 0), COALESCE(NEW.risk_score, 0))
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_conversation_risk ON ai_messages;
CREATE TRIGGER trg_sync_conversation_risk
  AFTER INSERT ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION sync_conversation_risk();

-- ─────────────────────────────────────────────────────────────────────────────
-- FEATURE 2: SILENT DISTRESS MODE
-- Extends emergency_sessions with distress signal tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE emergency_sessions
  ADD COLUMN IF NOT EXISTS is_silent          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tap_count          INTEGER,
  ADD COLUMN IF NOT EXISTS tap_window_ms      INTEGER,   -- time window of rapid taps
  ADD COLUMN IF NOT EXISTS silent_sms_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS silent_sms_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shelter_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shelter_ids_alerted UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ui_suppressed      BOOLEAN NOT NULL DEFAULT FALSE;

-- Add 'silent_distress' to trigger_type CHECK
ALTER TABLE emergency_sessions
  DROP CONSTRAINT IF EXISTS emergency_sessions_trigger_type_check;
ALTER TABLE emergency_sessions
  ADD CONSTRAINT emergency_sessions_trigger_type_check
  CHECK (trigger_type IN (
    'manual', 'shake_gesture', 'voice_command',
    'scheduled_check', 'auto_detect', 'silent_distress'
  ));

-- Fast lookup for active silent sessions needing follow-up
CREATE INDEX IF NOT EXISTS idx_emergency_silent_active
  ON emergency_sessions (user_id, started_at DESC)
  WHERE is_silent = TRUE AND ended_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- FEATURE 3: EMERGENCY LOCATION SHARING
-- New table: emergency_locations
-- Stores time-series GPS trail during active emergency sessions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS emergency_locations (
  id                BIGSERIAL PRIMARY KEY,   -- BIGSERIAL for high-volume time-series
  session_id        UUID NOT NULL REFERENCES emergency_sessions(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- GPS data
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  accuracy_m        DOUBLE PRECISION,        -- GPS accuracy radius in metres
  altitude_m        DOUBLE PRECISION,
  heading_deg       DOUBLE PRECISION,        -- 0–360, direction of travel
  speed_ms          DOUBLE PRECISION,        -- speed in m/s

  -- Device context
  device_type       TEXT,                    -- 'GPS', 'NETWORK', 'PASSIVE'
  battery_level     SMALLINT,                -- 0–100
  is_moving         BOOLEAN,

  -- Derived
  google_maps_url   TEXT GENERATED ALWAYS AS (
    'https://maps.google.com/?q=' || lat::TEXT || ',' || lng::TEXT
  ) STORED,

  -- Sharing state
  shared_with       UUID[] NOT NULL DEFAULT '{}',   -- help_service IDs that received this point
  share_count       SMALLINT NOT NULL DEFAULT 0,

  -- Timing
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by session for fast range queries (optional at scale)
-- For now, heavy partial indexes serve the same purpose:

-- Fast "latest point for session" query
CREATE INDEX IF NOT EXISTS idx_emergency_loc_session_time
  ON emergency_locations (session_id, captured_at DESC);

-- Fast "active session locations" query (for live tracking)
CREATE INDEX IF NOT EXISTS idx_emergency_loc_user_active
  ON emergency_locations (user_id, captured_at DESC)
  WHERE received_at > NOW() - INTERVAL '24 hours';

-- RLS
ALTER TABLE emergency_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_locations_owner_all"
  ON emergency_locations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "emergency_locations_admin_select"
  ON emergency_locations FOR SELECT
  USING (is_platform_admin());

COMMENT ON TABLE emergency_locations IS
  'Time-series GPS trail captured during active emergency sessions. '
  'High write volume — designed for append-only inserts. '
  'Never hard-delete (legal chain of custody).';

-- ─────────────────────────────────────────────────────────────────────────────
-- FEATURE 4: EVIDENCE VERIFICATION METADATA
-- Extends evidence table with device fingerprint and verification status
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE evidence
  -- Device metadata captured at upload time
  ADD COLUMN IF NOT EXISTS device_platform    TEXT,      -- 'android','ios','web','desktop'
  ADD COLUMN IF NOT EXISTS device_model       TEXT,      -- e.g. 'Samsung Galaxy A53'
  ADD COLUMN IF NOT EXISTS device_os_version  TEXT,      -- e.g. 'Android 13'
  ADD COLUMN IF NOT EXISTS app_version        TEXT,      -- Nia Path app version
  ADD COLUMN IF NOT EXISTS network_type       TEXT,      -- 'wifi','cellular','offline-sync'
  ADD COLUMN IF NOT EXISTS upload_ip_hash     TEXT,      -- SHA-256 of IP (privacy-preserving)
  ADD COLUMN IF NOT EXISTS user_agent_hash    TEXT,      -- SHA-256 of user agent string

  -- Extended checksum fields
  ADD COLUMN IF NOT EXISTS checksum_md5       TEXT,      -- MD5 (for compatibility)
  ADD COLUMN IF NOT EXISTS checksum_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_attempts SMALLINT NOT NULL DEFAULT 0,

  -- Verification pipeline status
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN (
      'pending',         -- just uploaded, awaiting n8n
      'verifying',       -- n8n Edge Function running
      'verified',        -- checksum matches, integrity confirmed
      'tampered',        -- checksum mismatch — ALERT
      'unverifiable'     -- file missing from storage
    )),
  ADD COLUMN IF NOT EXISTS verification_error  TEXT,

  -- EXIF / media metadata (extracted server-side)
  ADD COLUMN IF NOT EXISTS exif_data          JSONB,
  ADD COLUMN IF NOT EXISTS exif_gps_lat       DOUBLE PRECISION,  -- GPS from photo EXIF
  ADD COLUMN IF NOT EXISTS exif_gps_lng       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS exif_timestamp     TIMESTAMPTZ,       -- Camera timestamp from EXIF

  -- Chain of custody flags
  ADD COLUMN IF NOT EXISTS notarized_at       TIMESTAMPTZ,   -- When legally notarized
  ADD COLUMN IF NOT EXISTS notarization_ref   TEXT;          -- External notarization ID

-- Index for verification queue (n8n polls this)
CREATE INDEX IF NOT EXISTS idx_evidence_verification_queue
  ON evidence (verification_status, created_at)
  WHERE verification_status IN ('pending', 'verifying') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_tampered
  ON evidence (id)
  WHERE verification_status = 'tampered';

-- ─────────────────────────────────────────────────────────────────────────────
-- FEATURE 5: NEARBY HELP ROUTING
-- New table: service_searches — logs user help-center searches for analytics
-- Updates: help_services gets structured hours and response time fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE help_services
  ADD COLUMN IF NOT EXISTS response_time_minutes INTEGER,     -- avg response time
  ADD COLUMN IF NOT EXISTS accepts_walk_ins      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_safe_house        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS safe_house_capacity   INTEGER,
  ADD COLUMN IF NOT EXISTS whatsapp_link         TEXT,        -- wa.me/... deep link
  ADD COLUMN IF NOT EXISTS nearby_landmark       TEXT,        -- e.g. "Opposite KCB Bank"
  ADD COLUMN IF NOT EXISTS google_maps_place_id  TEXT;        -- For deep-linking Maps

-- Partial index for 24hr services (emergency lookup)
CREATE INDEX IF NOT EXISTS idx_help_24hr_emergency
  ON help_services (type, county, lat, lng)
  WHERE is_24_hour = TRUE AND verified = TRUE AND is_active = TRUE;

-- TABLE: service_searches
-- Analytics log — which services were shown to which users, anonymized
CREATE TABLE IF NOT EXISTS service_searches (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  search_lat      DOUBLE PRECISION NOT NULL,
  search_lng      DOUBLE PRECISION NOT NULL,
  radius_km       DOUBLE PRECISION NOT NULL DEFAULT 30,
  service_type    TEXT,
  results_count   SMALLINT,
  clicked_ids     UUID[] NOT NULL DEFAULT '{}',   -- which results were tapped
  called_ids      UUID[] NOT NULL DEFAULT '{}',   -- which services were called
  searched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE service_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_searches_own"
  ON service_searches FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_service_searches_user
  ON service_searches (user_id, searched_at DESC);

-- TABLE: location_shares
-- Explicit log of when location was shared with a specific help service
CREATE TABLE IF NOT EXISTS location_shares (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES emergency_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES help_services(id) ON DELETE CASCADE,

  -- What was shared
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  google_maps_url TEXT NOT NULL,
  message_sent    TEXT,                          -- SMS or notification body

  -- Status
  delivery_method TEXT NOT NULL DEFAULT 'sms'
    CHECK (delivery_method IN ('sms', 'whatsapp', 'email', 'api')),
  delivered       BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at    TIMESTAMPTZ,
  acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,

  shared_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE location_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_shares_own"
  ON location_shares FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_location_shares_session
  ON location_shares (session_id, shared_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED VIEWS for new fields
-- ─────────────────────────────────────────────────────────────────────────────

-- Extend case_summary view to include latest risk level from conversations
CREATE OR REPLACE VIEW case_summary AS
SELECT
  c.id,
  c.user_id,
  c.reference_number,
  c.title,
  c.category,
  c.status,
  c.ai_risk_level,
  c.ai_summary,
  c.incident_county,
  c.incident_start_date,
  c.evidence_count,
  c.timeline_event_count,
  c.created_at,
  c.updated_at,
  (
    SELECT jsonb_build_object(
      'id', e.id, 'type', e.type,
      'captured_at', e.captured_at,
      'verification_status', e.verification_status
    )
    FROM evidence e
    WHERE e.case_id = c.id AND e.deleted_at IS NULL
    ORDER BY e.captured_at DESC LIMIT 1
  ) AS latest_evidence,
  (
    SELECT p.display_name FROM profiles p
    WHERE p.id = c.assigned_legal_aid_id
  ) AS assigned_legal_aid_name,
  (
    SELECT max_risk_level FROM ai_conversations ac
    WHERE ac.case_id = c.id
    ORDER BY ac.created_at DESC LIMIT 1
  ) AS latest_conversation_risk,
  EXTRACT(DAY FROM NOW() - c.updated_at)::INTEGER AS days_since_update,
  (c.ai_risk_level IN ('high', 'critical')) AS is_urgent
FROM cases c
WHERE c.deleted_at IS NULL;

-- View: evidence with full verification context
CREATE OR REPLACE VIEW evidence_gallery AS
SELECT
  e.id, e.case_id, e.user_id,
  e.type, e.file_name,
  e.storage_bucket, e.storage_path,
  e.mime_type, e.file_size,
  e.duration_seconds, e.width, e.height,
  e.description, e.tags,
  e.location_lat, e.location_lng, e.location_name,
  e.exif_gps_lat, e.exif_gps_lng, e.exif_timestamp,
  e.captured_at, e.uploaded_at,
  e.checksum_sha256, e.checksum_md5,
  e.verification_status, e.checksum_verified,
  e.device_platform, e.device_model,
  e.submitted_to_police, e.submitted_to_court,
  e.ai_analyzed,
  e.storage_bucket || '/' || e.storage_path AS full_storage_reference
FROM evidence e
WHERE e.deleted_at IS NULL;

-- View: active emergency with latest location
CREATE OR REPLACE VIEW active_emergency_with_location AS
SELECT
  es.id,
  es.user_id,
  es.case_id,
  es.started_at,
  es.trigger_type,
  es.is_silent,
  es.alert_sent,
  es.silent_sms_sent,
  es.tap_count,
  EXTRACT(EPOCH FROM (NOW() - es.started_at))::INTEGER AS duration_seconds,
  -- Latest known location
  el.lat AS current_lat,
  el.lng AS current_lng,
  el.accuracy_m AS location_accuracy,
  el.captured_at AS location_captured_at,
  el.google_maps_url,
  el.battery_level,
  -- User context
  p.county AS user_county,
  p.language_preference
FROM emergency_sessions es
JOIN profiles p ON p.id = es.user_id
LEFT JOIN LATERAL (
  SELECT lat, lng, accuracy_m, captured_at, google_maps_url, battery_level
  FROM emergency_locations
  WHERE session_id = es.id
  ORDER BY captured_at DESC
  LIMIT 1
) el ON TRUE
WHERE es.ended_at IS NULL
  AND es.started_at > NOW() - INTERVAL '24 hours';

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED FUNCTION: get_nearby_help_services
-- Now returns richer data including response time and safe house info
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_nearby_help_services(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50,
  service_type TEXT DEFAULT NULL,
  emergency_only BOOLEAN DEFAULT FALSE,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  type TEXT,
  phone TEXT,
  phone_toll_free TEXT,
  whatsapp TEXT,
  whatsapp_link TEXT,
  address TEXT,
  county TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  nearby_landmark TEXT,
  hours TEXT,
  is_24_hour BOOLEAN,
  description TEXT,
  services_offered TEXT[],
  response_time_minutes INTEGER,
  has_safe_house BOOLEAN,
  accepts_walk_ins BOOLEAN,
  rating_average NUMERIC,
  rating_count INTEGER,
  distance_km DOUBLE PRECISION,
  is_at_capacity BOOLEAN,
  google_maps_place_id TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    hs.id, hs.name, hs.slug, hs.type,
    hs.phone, hs.phone_toll_free, hs.whatsapp, hs.whatsapp_link,
    hs.address, hs.county, hs.lat, hs.lng, hs.nearby_landmark,
    hs.hours, hs.is_24_hour, hs.description,
    hs.services_offered, hs.response_time_minutes,
    hs.has_safe_house, hs.accepts_walk_ins,
    hs.rating_average, hs.rating_count,
    ROUND(haversine_km(user_lat, user_lng, hs.lat, hs.lng)::NUMERIC, 2) AS distance_km,
    hs.is_at_capacity,
    hs.google_maps_place_id
  FROM help_services hs
  WHERE
    hs.verified = TRUE
    AND hs.is_active = TRUE
    AND (service_type IS NULL OR hs.type = service_type)
    AND (NOT emergency_only OR hs.is_24_hour = TRUE)
    AND haversine_km(user_lat, user_lng, hs.lat, hs.lng) <= radius_km
  ORDER BY
    -- 24hr services first in emergency mode
    CASE WHEN emergency_only AND hs.is_24_hour THEN 0 ELSE 1 END,
    distance_km ASC
  LIMIT result_limit;
$$;

COMMENT ON FUNCTION get_nearby_help_services IS
  'Returns verified help services sorted by distance. '
  'emergency_only=TRUE filters to 24hr services only.';
