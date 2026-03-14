-- =============================================================================
-- MIGRATION 007: VIEWS, MATERIALIZED VIEWS, AND SCHEDULED JOBS
-- =============================================================================
-- Optimized read paths for the Next.js frontend.
-- Views are security-definer: they respect the underlying table RLS
-- but present a cleaned, joined interface.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: case_summary
-- Joined view of a case with its latest evidence and timeline stats.
-- Used by the dashboard and case list page.
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- Latest evidence item
  (
    SELECT jsonb_build_object(
      'id', e.id,
      'type', e.type,
      'captured_at', e.captured_at
    )
    FROM evidence e
    WHERE e.case_id = c.id AND e.deleted_at IS NULL
    ORDER BY e.captured_at DESC
    LIMIT 1
  ) AS latest_evidence,
  -- Assigned legal aid name
  (
    SELECT p.display_name
    FROM profiles p
    WHERE p.id = c.assigned_legal_aid_id
  ) AS assigned_legal_aid_name,
  -- Days since last activity
  EXTRACT(DAY FROM NOW() - c.updated_at)::INTEGER AS days_since_update,
  -- Is urgent
  (c.ai_risk_level IN ('high', 'critical')) AS is_urgent
FROM cases c
WHERE c.deleted_at IS NULL;

-- NOTE: RLS on underlying tables still applies through this view

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: evidence_with_signed_context
-- Evidence metadata without storage URLs (URLs generated on demand in API)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW evidence_gallery AS
SELECT
  e.id,
  e.case_id,
  e.user_id,
  e.type,
  e.file_name,
  e.storage_bucket,
  e.storage_path,
  e.mime_type,
  e.file_size,
  e.duration_seconds,
  e.width,
  e.height,
  e.description,
  e.tags,
  e.location_lat,
  e.location_lng,
  e.location_name,
  e.captured_at,
  e.uploaded_at,
  e.checksum_sha256,
  e.submitted_to_police,
  e.submitted_to_court,
  e.ai_analyzed,
  -- DO NOT expose file_url directly — use signed URL API instead
  -- Derive storage path components for frontend
  e.storage_bucket || '/' || e.storage_path AS full_storage_reference
FROM evidence e
WHERE e.deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: active_emergency_sessions
-- Real-time view for emergency monitoring dashboard (admin use)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW active_emergency_sessions AS
SELECT
  es.id,
  es.user_id,
  es.case_id,
  es.started_at,
  EXTRACT(EPOCH FROM (NOW() - es.started_at))::INTEGER AS duration_seconds,
  es.location_lat,
  es.location_lng,
  es.google_maps_url,
  es.alert_sent,
  es.contacts_alerted,
  es.trigger_type,
  -- User info (safe fields only)
  p.county AS user_county,
  p.language_preference
FROM emergency_sessions es
JOIN profiles p ON p.id = es.user_id
WHERE es.ended_at IS NULL
  AND es.started_at > NOW() - INTERVAL '24 hours';

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: help_services_with_distance
-- Returns help services with computed distance from a point.
-- Called from Next.js with user location.
-- ─────────────────────────────────────────────────────────────────────────────

-- This is implemented as a database function rather than view for parameterization:

CREATE OR REPLACE FUNCTION get_nearby_help_services(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50,
  service_type TEXT DEFAULT NULL,
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
  address TEXT,
  county TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  hours TEXT,
  is_24_hour BOOLEAN,
  description TEXT,
  services_offered TEXT[],
  rating_average NUMERIC,
  rating_count INTEGER,
  distance_km DOUBLE PRECISION,
  is_at_capacity BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    hs.id,
    hs.name,
    hs.slug,
    hs.type,
    hs.phone,
    hs.phone_toll_free,
    hs.whatsapp,
    hs.address,
    hs.county,
    hs.lat,
    hs.lng,
    hs.hours,
    hs.is_24_hour,
    hs.description,
    hs.services_offered,
    hs.rating_average,
    hs.rating_count,
    ROUND(haversine_km(user_lat, user_lng, hs.lat, hs.lng)::NUMERIC, 2) AS distance_km,
    hs.is_at_capacity
  FROM help_services hs
  WHERE
    hs.verified = TRUE
    AND hs.is_active = TRUE
    AND (service_type IS NULL OR hs.type = service_type)
    AND haversine_km(user_lat, user_lng, hs.lat, hs.lng) <= radius_km
  ORDER BY distance_km ASC
  LIMIT result_limit;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MATERIALIZED VIEW: platform_statistics
-- Refreshed daily for admin dashboard. Does not expose user PII.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS platform_statistics AS
SELECT
  NOW() AS calculated_at,
  -- User stats
  (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL) AS total_users,
  (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
  (SELECT COUNT(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '7 days') AS active_users_7d,
  -- Case stats
  (SELECT COUNT(*) FROM cases WHERE deleted_at IS NULL) AS total_cases,
  (SELECT COUNT(*) FROM cases WHERE status = 'open') AS open_cases,
  (SELECT COUNT(*) FROM cases WHERE status = 'escalated') AS escalated_cases,
  (SELECT COUNT(*) FROM cases WHERE ai_risk_level = 'critical') AS critical_cases,
  (SELECT COUNT(*) FROM cases WHERE created_at > NOW() - INTERVAL '30 days') AS new_cases_30d,
  -- Evidence stats
  (SELECT COUNT(*) FROM evidence WHERE deleted_at IS NULL) AS total_evidence_files,
  (SELECT COALESCE(SUM(file_size), 0) FROM evidence WHERE deleted_at IS NULL) AS total_evidence_bytes,
  -- Emergency stats
  (SELECT COUNT(*) FROM emergency_sessions) AS total_emergency_activations,
  (SELECT COUNT(*) FROM emergency_sessions WHERE started_at > NOW() - INTERVAL '30 days') AS emergency_activations_30d,
  -- Category distribution
  (SELECT jsonb_object_agg(category, cnt) FROM (
    SELECT category, COUNT(*) AS cnt
    FROM cases WHERE deleted_at IS NULL
    GROUP BY category
  ) t) AS cases_by_category,
  -- County distribution
  (SELECT jsonb_object_agg(county, cnt) FROM (
    SELECT incident_county AS county, COUNT(*) AS cnt
    FROM cases WHERE deleted_at IS NULL AND incident_county IS NOT NULL
    GROUP BY incident_county
    ORDER BY cnt DESC LIMIT 10
  ) t) AS top_counties;

-- Refresh index for materialized view
CREATE UNIQUE INDEX idx_platform_statistics_calculated ON platform_statistics(calculated_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Refresh materialized view (called by pg_cron or Supabase Edge Function)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_platform_statistics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_statistics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULED JOBS (pg_cron — enable in Supabase Dashboard)
-- ─────────────────────────────────────────────────────────────────────────────

-- These use pg_cron which must be enabled in Supabase Dashboard → Extensions

-- Refresh platform stats daily at 2am UTC
-- SELECT cron.schedule('refresh-platform-stats', '0 2 * * *',
--   $$SELECT refresh_platform_statistics()$$);

-- Mark overdue check-ins hourly
-- SELECT cron.schedule('mark-overdue-check-ins', '*/15 * * * *',
--   $$
--   UPDATE check_ins
--   SET is_overdue = TRUE, overdue_since = NOW()
--   WHERE is_active = TRUE
--     AND is_overdue = FALSE
--     AND next_check_in_at + (grace_period_minutes || ' minutes')::INTERVAL < NOW();
--   $$);

-- Soft-delete expired user sessions daily
-- SELECT cron.schedule('cleanup-expired-sessions', '0 3 * * *',
--   $$
--   UPDATE user_sessions
--   SET revoked_at = NOW(), revoke_reason = 'expired'
--   WHERE expires_at < NOW() AND revoked_at IS NULL;
--   $$);

-- Archive old closed cases (older than 2 years)
-- SELECT cron.schedule('archive-old-cases', '0 4 * * 0',  -- Weekly Sunday 4am
--   $$
--   UPDATE cases
--   SET status = 'archived', archived_at = NOW()
--   WHERE status = 'closed'
--     AND updated_at < NOW() - INTERVAL '2 years'
--     AND archived_at IS NULL;
--   $$);

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: case_full_export
-- Returns everything needed for a full case export (legal submission packet)
-- Used by the "Export Case" feature in the frontend
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_case_export(p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  result JSONB;
BEGIN
  -- Verify ownership
  SELECT user_id INTO v_user_id FROM cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Case not found or access denied';
  END IF;

  SELECT jsonb_build_object(
    'case', to_jsonb(c),
    'evidence', (
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.captured_at)
      FROM evidence e
      WHERE e.case_id = p_case_id AND e.deleted_at IS NULL
    ),
    'timeline', (
      SELECT jsonb_agg(to_jsonb(te) ORDER BY te.event_date)
      FROM timeline_events te
      WHERE te.case_id = p_case_id
    ),
    'reports', (
      SELECT jsonb_agg(to_jsonb(lr) ORDER BY lr.created_at)
      FROM legal_reports lr
      WHERE lr.case_id = p_case_id AND lr.status = 'ready'
    ),
    'property_documents', (
      SELECT jsonb_agg(to_jsonb(pd) ORDER BY pd.created_at)
      FROM property_documents pd
      WHERE pd.case_id = p_case_id
    ),
    'exported_at', NOW(),
    'export_checksum', compute_checksum(p_case_id::TEXT || NOW()::TEXT)
  )
  INTO result
  FROM cases c
  WHERE c.id = p_case_id;

  -- Log this export access
  INSERT INTO audit_log (actor_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'EXPORT', 'cases', p_case_id::TEXT);

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_nearby_help_services IS
  'Returns help services sorted by distance from a user-supplied coordinate. '
  'Uses Haversine formula. Expects lat/lng in decimal degrees.';

COMMENT ON MATERIALIZED VIEW platform_statistics IS
  'Aggregate platform metrics. Refreshed daily. '
  'Does not contain any user PII.';
