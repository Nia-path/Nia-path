-- =============================================================================
-- MIGRATION 000: EXTENSIONS, TYPES, AND FOUNDATIONAL SETUP
-- Nia Path AI – Women's Justice & Protection Platform
-- Principal Engineer: Production Schema v1.0
-- =============================================================================
-- Run order: 000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008
-- All migrations are idempotent (safe to re-run)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: EXTENSIONS
-- Enable all required PostgreSQL extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- Trigram fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";         -- Accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "btree_gist";       -- GiST index for ranges
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring

-- PostGIS for geospatial queries (nearest help services)
-- Uncomment if PostGIS is available on your Supabase plan:
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: CUSTOM ENUM TYPES
-- Defined as CHECK constraints for portability, but documented as enums here
-- ─────────────────────────────────────────────────────────────────────────────

-- User roles define what capabilities a user has in the system
-- individual    → standard user, a woman seeking justice
-- legal_aid     → verified legal professional who can be assigned cases
-- admin         → platform administrator (Nia Path staff)
-- moderator     → content moderator for help_services verification

-- Case categories align with the specific legal frameworks in Kenya
-- domestic_violence          → Protection Against Domestic Violence Act 2015
-- sexual_harassment          → Sexual Offences Act 2006
-- workplace_discrimination   → Employment Act + COTU frameworks
-- property_rights            → Land Registration Act + Succession Act
-- child_custody              → Children Act 2001
-- financial_abuse            → Banking/fraud statutes
-- gbv_other                  → Gender-based violence not otherwise classified
-- other                      → General legal matters

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: UTILITY FUNCTIONS
-- Reusable functions used across the schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Automatically updates updated_at on any table that calls it
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Returns the user_id of the currently authenticated user
-- Wraps auth.uid() for cleaner usage in RLS policies
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;





-- Computes SHA-256 checksum of text (for evidence integrity verification)
-- Falls back to MD5 if pgcrypto digest is unavailable
CREATE OR REPLACE FUNCTION compute_checksum(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  BEGIN
    RETURN encode(digest(input_text, 'sha256'), 'hex');
  EXCEPTION WHEN undefined_function THEN
    -- Fallback to MD5 if SHA-256 is not available
    RETURN encode(digest(input_text, 'md5'), 'hex');
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Haversine distance in km between two lat/lng points
-- Used when PostGIS is not available
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371;
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  a := SIN(dlat/2)^2 + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2)^2;
  RETURN r * 2 * ASIN(SQRT(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: AUDIT LOG TABLE
-- Immutable append-only log of all sensitive data operations
-- Critical for legal evidence integrity and compliance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  -- Who performed the action
  actor_id      UUID,                         -- auth.uid() at time of action (NULL = system)
  actor_role    TEXT,                         -- role snapshot at time of action
  -- What was done
  action        TEXT NOT NULL,               -- INSERT, UPDATE, DELETE, ACCESS, LOGIN, etc.
  resource_type TEXT NOT NULL,               -- Table or resource type affected
  resource_id   TEXT,                        -- ID of the affected resource
  -- Details
  old_data      JSONB,                       -- Previous state (for UPDATE/DELETE)
  new_data      JSONB,                       -- New state (for INSERT/UPDATE)
  changed_fields TEXT[],                     -- Array of field names that changed
  -- Context
  ip_address    INET,                        -- Client IP (from request header)
  user_agent    TEXT,                        -- Browser/app user agent
  session_id    TEXT,                        -- Supabase session ID
  request_id    TEXT,                        -- Unique request identifier
  -- Timing
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is NEVER modified after insertion — no UPDATE/DELETE policies
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_log are defined in migration 001 (after is_platform_admin() function exists)
-- No policies = no read access by default until explicitly granted in 001

-- Prevent direct inserts from client (service role only via triggers)
-- No INSERT policy = only service role can write

-- Partial index for fast lookups by resource
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_log (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_occurred_at ON audit_log (occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_log (action);

COMMENT ON TABLE audit_log IS
  'Immutable append-only audit trail. Never modified after insert. '
  'Required for legal evidence chain of custody.';

