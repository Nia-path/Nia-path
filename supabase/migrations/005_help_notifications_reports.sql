-- =============================================================================
-- MIGRATION 005: HELP SERVICES, NOTIFICATIONS, AND LEGAL REPORTS
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: help_services
-- Directory of verified support organizations across Kenya.
-- Publicly readable (verified=TRUE). Admin-managed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS help_services (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,              -- URL-friendly identifier
  organization_code   TEXT UNIQUE,                       -- Official registration number

  -- Classification
  type                TEXT NOT NULL
                      CHECK (type IN (
                        'shelter',
                        'legal_aid',
                        'police_gender_desk',
                        'counseling',
                        'medical',
                        'financial_support',
                        'child_protection',
                        'hotline'
                      )),
  sub_types           TEXT[] NOT NULL DEFAULT '{}',      -- Multiple specializations

  -- Contact
  phone               TEXT NOT NULL,
  phone_toll_free     TEXT,                              -- Free-to-call number
  whatsapp            TEXT,
  email               TEXT,
  website             TEXT,

  -- Location
  address             TEXT NOT NULL,
  county              TEXT NOT NULL,
  sub_county          TEXT,
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,

  -- Operating hours
  hours               TEXT NOT NULL,                     -- Human-readable hours string
  is_24_hour          BOOLEAN NOT NULL DEFAULT FALSE,
  hours_structured    JSONB,                             -- {mon: "8:00-17:00", ...}

  -- Service details
  description         TEXT NOT NULL,
  services_offered    TEXT[] NOT NULL DEFAULT '{}',
  languages_supported TEXT[] NOT NULL DEFAULT '{en, sw}',
  capacity_per_day    INTEGER,                           -- Max clients/day (if shelter)
  has_legal_clinic    BOOLEAN NOT NULL DEFAULT FALSE,
  serves_children     BOOLEAN NOT NULL DEFAULT TRUE,

  -- Verification
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES profiles(id),
  last_confirmed_at   TIMESTAMPTZ,                       -- When info was last confirmed accurate
  verification_source TEXT,                              -- How verification was done

  -- Rating
  rating_count        INTEGER NOT NULL DEFAULT 0,
  rating_sum          INTEGER NOT NULL DEFAULT 0,
  rating_average      NUMERIC(3,2) GENERATED ALWAYS AS (
                        CASE WHEN rating_count > 0
                        THEN ROUND(rating_sum::NUMERIC / rating_count, 2)
                        ELSE NULL END
                      ) STORED,

  -- Status
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_at_capacity      BOOLEAN NOT NULL DEFAULT FALSE,    -- Real-time capacity flag
  suspension_note     TEXT,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_help_services_updated_at
  BEFORE UPDATE ON help_services
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE help_services ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read verified, active services
CREATE POLICY "help_services_public_select"
  ON help_services FOR SELECT
  USING (verified = TRUE AND is_active = TRUE);

-- Admins and moderators can manage services
CREATE POLICY "help_services_admin_all"
  ON help_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE INDEX idx_help_services_type ON help_services(type) WHERE verified = TRUE AND is_active = TRUE;
CREATE INDEX idx_help_services_county ON help_services(county) WHERE verified = TRUE AND is_active = TRUE;
CREATE INDEX idx_help_services_location ON help_services(lat, lng) WHERE verified = TRUE AND is_active = TRUE;
CREATE INDEX idx_help_services_24hr ON help_services(is_24_hour) WHERE verified = TRUE AND is_active = TRUE;

-- Full-text search index for help services
CREATE INDEX idx_help_services_fts ON help_services
  USING GIN(to_tsvector('english', name || ' ' || description || ' ' || county));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: service_ratings
-- User ratings for help services (anonymous by default)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES help_services(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_anonymous  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, user_id)
);

ALTER TABLE service_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_ratings_owner_all"
  ON service_ratings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "service_ratings_public_select"
  ON service_ratings FOR SELECT
  USING (is_anonymous = TRUE);

-- Trigger: update denormalized rating on help_services
CREATE OR REPLACE FUNCTION update_service_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE help_services
    SET rating_count = rating_count + 1, rating_sum = rating_sum + NEW.rating
    WHERE id = NEW.service_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE help_services
    SET rating_sum = rating_sum - OLD.rating + NEW.rating
    WHERE id = NEW.service_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE help_services
    SET rating_count = GREATEST(0, rating_count - 1),
        rating_sum = GREATEST(0, rating_sum - OLD.rating)
    WHERE id = OLD.service_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_service_rating
  AFTER INSERT OR UPDATE OR DELETE ON service_ratings
  FOR EACH ROW EXECUTE FUNCTION update_service_rating();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: notifications
-- Platform notifications to users. Feeds in-app notification center.
-- Also used to track n8n-sent SMS/email alerts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Content
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL
                  CHECK (type IN (
                    'emergency_alert',        -- SOS activation
                    'case_update',            -- Case status changed
                    'evidence_sync',          -- Offline evidence synced
                    'legal_aid_assigned',     -- Legal aid assigned to case
                    'legal_aid_note',         -- Legal aid added note
                    'report_ready',           -- Report generated
                    'check_in_reminder',      -- Safety check-in reminder
                    'system'                  -- Platform announcement
                  )),

  -- Linking
  related_case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  related_url     TEXT,                      -- Deep link URL

  -- Delivery
  channel         TEXT[] NOT NULL DEFAULT '{in_app}',   -- in_app, sms, push, email
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  is_urgent       BOOLEAN NOT NULL DEFAULT FALSE,

  -- External delivery tracking
  sms_sent        BOOLEAN NOT NULL DEFAULT FALSE,
  sms_sent_at     TIMESTAMPTZ,
  push_sent       BOOLEAN NOT NULL DEFAULT FALSE,
  push_sent_at    TIMESTAMPTZ,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_owner_all"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_urgent ON notifications(user_id) WHERE is_urgent = TRUE AND is_read = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: legal_reports
-- Generated PDF legal reports. Separate from evidence — these are outputs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  generated_by        UUID REFERENCES profiles(id),      -- NULL = AI-generated

  -- Report content
  report_type         TEXT NOT NULL
                      CHECK (report_type IN (
                        'incident_report',     -- Summary of incident for police/court
                        'evidence_summary',    -- List of all evidence with metadata
                        'timeline_report',     -- Chronological case timeline
                        'property_claim',      -- Property rights claim document
                        'legal_brief'          -- Full legal brief for court
                      )),
  title               TEXT NOT NULL,
  content_text        TEXT,                              -- Markdown/text version
  storage_path        TEXT,                              -- PDF in 'reports' bucket
  storage_bucket      TEXT NOT NULL DEFAULT 'reports',

  -- Integrity
  checksum_sha256     TEXT,
  page_count          INTEGER,
  word_count          INTEGER,

  -- AI generation metadata
  ai_model_used       TEXT,
  generation_prompt   TEXT,
  generation_tokens   INTEGER,

  -- Status
  status              TEXT NOT NULL DEFAULT 'generating'
                      CHECK (status IN ('generating', 'ready', 'failed', 'archived')),
  is_final            BOOLEAN NOT NULL DEFAULT FALSE,    -- Finalized for submission
  finalized_at        TIMESTAMPTZ,
  finalized_by        UUID REFERENCES profiles(id),

  -- Submission tracking
  submitted_to_police   BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_to_police_at TIMESTAMPTZ,
  submitted_to_court    BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_to_court_at TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_legal_reports_updated_at
  BEFORE UPDATE ON legal_reports
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE legal_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_reports_owner_select"
  ON legal_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "legal_reports_legal_aid_select"
  ON legal_reports FOR SELECT
  USING (legal_aid_has_case_access(case_id));

CREATE POLICY "legal_reports_owner_insert"
  ON legal_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_legal_reports_case ON legal_reports(case_id, created_at DESC);
CREATE INDEX idx_legal_reports_status ON legal_reports(status) WHERE status = 'ready';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: check_ins
-- Safety check-in system. Users set a schedule; if they miss a check-in,
-- emergency contacts are automatically notified via n8n.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS check_ins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Schedule
  frequency           TEXT NOT NULL
                      CHECK (frequency IN ('hourly', 'every_4h', 'every_8h', 'daily', 'custom')),
  next_check_in_at    TIMESTAMPTZ NOT NULL,
  last_checked_in_at  TIMESTAMPTZ,

  -- Grace period before alerting contacts
  grace_period_minutes INTEGER NOT NULL DEFAULT 30,

  -- Status
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_overdue          BOOLEAN NOT NULL DEFAULT FALSE,
  overdue_since       TIMESTAMPTZ,
  alert_triggered     BOOLEAN NOT NULL DEFAULT FALSE,
  alert_triggered_at  TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_check_ins_updated_at
  BEFORE UPDATE ON check_ins
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_ins_owner_all"
  ON check_ins FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_check_ins_overdue ON check_ins(next_check_in_at)
  WHERE is_active = TRUE AND alert_triggered = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: n8n_webhook_log
-- Tracks all outbound n8n workflow invocations for debugging and retry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS n8n_webhook_log (
  id              BIGSERIAL PRIMARY KEY,
  webhook_name    TEXT NOT NULL,                         -- Logical name of workflow
  webhook_url     TEXT NOT NULL,
  payload         JSONB NOT NULL,
  response_status INTEGER,
  response_body   TEXT,
  execution_id    TEXT,                                  -- n8n execution ID
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE n8n_webhook_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook log (no client access)
-- No policies created = only service_role can read/write

CREATE INDEX idx_n8n_log_status ON n8n_webhook_log(status, next_retry_at)
  WHERE status IN ('pending', 'failed', 'retrying');
CREATE INDEX idx_n8n_log_created ON n8n_webhook_log(created_at DESC);

COMMENT ON TABLE n8n_webhook_log IS
  'Outbound webhook invocation log for n8n automation workflows. '
  'Supports retry logic for failed webhook deliveries.';
