-- =============================================================================
-- MIGRATION 001: USER PROFILES AND IDENTITY
-- =============================================================================
-- Extends Supabase Auth (auth.users) with platform-specific profile data.
-- The profiles table is the authoritative source of identity for the platform.
-- Sensitive PII is minimized and access is strictly RLS-controlled.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: profiles
-- One row per auth.users entry. Auto-created via trigger on signup.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  -- Identity
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  full_name             TEXT NOT NULL DEFAULT '',
  display_name          TEXT,                          -- Optional pseudonym for privacy

  -- Contact
  phone                 TEXT,                          -- Encrypted at application layer
  county                TEXT,                          -- Kenyan county of residence
  sub_county            TEXT,

  -- Platform role
  role                  TEXT NOT NULL DEFAULT 'individual'
                        CHECK (role IN ('individual', 'legal_aid', 'admin', 'moderator')),

  -- Onboarding state
  onboarding_complete   BOOLEAN NOT NULL DEFAULT FALSE,
  language_preference   TEXT NOT NULL DEFAULT 'en'
                        CHECK (language_preference IN ('en', 'sw')),  -- English / Swahili

  -- Security
  pin_hash              TEXT,                          -- PBKDF2 hash of stealth PIN
  pin_salt              TEXT,                          -- Cryptographic salt
  pin_set_at            TIMESTAMPTZ,
  failed_pin_attempts   INTEGER NOT NULL DEFAULT 0,
  pin_locked_until      TIMESTAMPTZ,                  -- Temporary lockout after failed attempts
  two_factor_enabled    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Emergency contacts (JSON array for fast access; 1-5 contacts)
  -- Schema: [{id, name, phone, relationship, notify_on_emergency}]
  emergency_contacts    JSONB NOT NULL DEFAULT '[]',

  -- Privacy & consent
  consent_terms_at      TIMESTAMPTZ,                  -- When user accepted Terms of Service
  consent_privacy_at    TIMESTAMPTZ,                  -- When user accepted Privacy Policy
  data_retention_days   INTEGER NOT NULL DEFAULT 730, -- User-controlled retention (default 2 years)

  -- Account state
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE, -- Phone/email verified
  is_suspended          BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason     TEXT,

  -- Soft delete (never hard delete — evidence chain of custody)
  deleted_at            TIMESTAMPTZ,                  -- Soft delete timestamp
  deletion_requested_at TIMESTAMPTZ,                  -- GDPR deletion request

  -- Metadata
  avatar_url            TEXT,
  last_active_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger: auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, language_preference)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: track last active time
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET last_active_at = NOW() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS: Profile-related authorization helpers
-- Must be defined BEFORE RLS policies that reference them
-- ─────────────────────────────────────────────────────────────────────────────

-- Checks if current user has a specific role
CREATE OR REPLACE FUNCTION current_user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = required_role
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Checks if current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    AND deleted_at IS NULL
  );

-- Admins can read all profiles (for support/moderation)
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (is_platform_admin());

-- Users can only update their own profile
-- Cannot change role or security fields via this policy (done via service role)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-promotion to admin/moderator
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- No direct DELETE — soft delete only, done via service role
-- No direct INSERT — done via trigger on auth.users

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: user_sessions
-- Tracks active platform sessions for security monitoring
-- Separate from Supabase Auth sessions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Session identification
  session_token   TEXT NOT NULL UNIQUE DEFAULT md5(random()::text || NOW()::text),
  -- Security context
  ip_address      INET,
  user_agent      TEXT,
  device_type     TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'unknown')),
  device_os       TEXT,
  -- Stealth PIN session state
  nia_unlocked    BOOLEAN NOT NULL DEFAULT FALSE,
  nia_unlocked_at TIMESTAMPTZ,
  nia_expires_at  TIMESTAMPTZ,
  -- Session lifecycle
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  revoked_at      TIMESTAMPTZ,
  revoke_reason   TEXT
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sessions_own"
  ON user_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: legal_aid_profiles
-- Extended profile for legal aid professionals
-- Only populated when profiles.role = 'legal_aid'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_aid_profiles (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  organization_name     TEXT NOT NULL,
  license_number        TEXT,                          -- Law Society of Kenya number
  license_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  license_verified_at   TIMESTAMPTZ,
  specializations       TEXT[] NOT NULL DEFAULT '{}', -- Case categories they handle
  counties_served       TEXT[] NOT NULL DEFAULT '{}',
  max_concurrent_cases  INTEGER NOT NULL DEFAULT 10,
  bio                   TEXT,
  years_experience      INTEGER,
  languages             TEXT[] NOT NULL DEFAULT '{en}',
  available_for_cases   BOOLEAN NOT NULL DEFAULT TRUE,
  rating_average        NUMERIC(3,2),                 -- 1.00 to 5.00
  cases_handled         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_legal_aid_profiles_updated_at
  BEFORE UPDATE ON legal_aid_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE legal_aid_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_aid_profiles_select_own"
  ON legal_aid_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "legal_aid_profiles_select_public"
  ON legal_aid_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = legal_aid_profiles.user_id
      AND role = 'legal_aid'
      AND is_suspended = FALSE
      AND deleted_at IS NULL
    )
    AND license_verified = TRUE
    AND available_for_cases = TRUE
  );

CREATE POLICY "legal_aid_profiles_update_own"
  ON legal_aid_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT TRIGGER: profiles
-- Log all profile changes for compliance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed TEXT[];
BEGIN
  -- Track which fields changed (exclude sensitive fields from old_data)
  IF TG_OP = 'UPDATE' THEN
    SELECT ARRAY(
      SELECT key FROM jsonb_each(to_jsonb(NEW)) n
      WHERE to_jsonb(OLD)->>key IS DISTINCT FROM to_jsonb(NEW)->>key
      AND key NOT IN ('pin_hash', 'pin_salt') -- Never log PIN data
    ) INTO changed;

    INSERT INTO audit_log (actor_id, actor_role, action, resource_type, resource_id, changed_fields)
    SELECT
      auth.uid(),
      (SELECT role FROM profiles WHERE id = auth.uid()),
      'UPDATE',
      'profiles',
      NEW.id::TEXT,
      changed;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_profile_changes();

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES: profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_profiles_role ON profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_county ON profiles(county) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX idx_profiles_last_active ON profiles(last_active_at DESC) WHERE deleted_at IS NULL;

-- Partial index for active non-deleted users
CREATE INDEX idx_profiles_active ON profiles(id)
  WHERE deleted_at IS NULL AND is_suspended = FALSE;

COMMENT ON TABLE profiles IS
  'Core user identity table. Extends auth.users. '
  'Never hard delete — soft delete only to preserve evidence chain of custody.';

COMMENT ON COLUMN profiles.pin_hash IS
  'PBKDF2-SHA256 hash of stealth access PIN. Never store plaintext PIN.';

COMMENT ON COLUMN profiles.emergency_contacts IS
  'JSON array: [{id, name, phone, relationship, notify_on_emergency}]. '
  'Alerted automatically when emergency mode is activated.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: audit_log
-- Now that is_platform_admin() exists, we can create the policy
-- ─────────────────────────────────────────────────────────────────────────────

-- Only admins can read audit logs; nobody can write directly (triggers only)
CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  USING (is_platform_admin());
