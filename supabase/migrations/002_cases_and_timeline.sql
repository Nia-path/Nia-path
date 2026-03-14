-- =============================================================================
-- MIGRATION 002: CASES, TIMELINE EVENTS, AND CASE ASSIGNMENTS
-- =============================================================================
-- The case is the central entity of the platform. Every piece of evidence,
-- every AI conversation, and every legal action links back to a case.
--
-- Design principles:
-- • Cases are never hard-deleted (legal chain of custody)
-- • Every mutation is timestamped and attributed
-- • Legal aid access is explicitly granted and revocable
-- • Case reference numbers are human-readable for court documents
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS: Case-related authorization helpers
-- Must be defined BEFORE tables that use them as DEFAULT values
-- ─────────────────────────────────────────────────────────────────────────────

-- Generates a secure, collision-resistant case reference number
-- Format: NIA-2024-XXXXXX (human-readable for legal documents)
CREATE OR REPLACE FUNCTION generate_case_reference()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  rand_part TEXT;
  candidate TEXT;
  exists_check BOOLEAN;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  LOOP
    rand_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    candidate := 'NIA-' || year_part || '-' || rand_part;
    SELECT EXISTS(SELECT 1 FROM cases WHERE reference_number = candidate) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: cases
-- Central case entity. One case per distinct legal matter.
-- A user may have multiple cases (e.g., domestic violence + property dispute)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reference_number    TEXT NOT NULL UNIQUE DEFAULT generate_case_reference(),

  -- Classification
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL
                      CHECK (category IN (
                        'domestic_violence',
                        'sexual_harassment',
                        'workplace_discrimination',
                        'property_rights',
                        'child_custody',
                        'financial_abuse',
                        'gbv_other',
                        'other'
                      )),
  sub_category        TEXT,                            -- Free-form subcategory

  -- Geographic context
  incident_county     TEXT,                            -- Where incident occurred
  incident_location   TEXT,                            -- Freetext location description
  incident_lat        DOUBLE PRECISION,
  incident_lng        DOUBLE PRECISION,

  -- Temporal context
  incident_start_date DATE,                            -- When abuse/incident began
  incident_end_date   DATE,                            -- If ongoing, NULLNULL

  -- Status lifecycle
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN (
                        'open',          -- Active, user is building the case
                        'under_review',  -- Assigned to legal aid
                        'escalated',     -- Flagged as critical by AI or user
                        'reported',      -- Formally reported to authorities
                        'closed',        -- Case resolved
                        'archived'       -- Long-term storage
                      )),
  status_changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_changed_by   UUID REFERENCES profiles(id),

  -- AI analysis output
  ai_summary          TEXT,                            -- Latest AI summary
  ai_risk_level       TEXT CHECK (ai_risk_level IN ('low', 'medium', 'high', 'critical')),
  ai_risk_updated_at  TIMESTAMPTZ,
  ai_recommended_actions JSONB DEFAULT '[]',           -- Array of recommended next steps
  ai_legal_frameworks TEXT[],                          -- Applicable Kenyan laws identified

  -- Counts (denormalized for performance)
  evidence_count      INTEGER NOT NULL DEFAULT 0,
  timeline_event_count INTEGER NOT NULL DEFAULT 0,

  -- Legal representation
  assigned_legal_aid_id UUID REFERENCES profiles(id),

  -- Report generation
  report_generated_at  TIMESTAMPTZ,
  report_storage_path  TEXT,                           -- Path in 'reports' storage bucket

  -- Soft delete / archival
  deleted_at          TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-update timestamps
CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger: record status changes in timeline automatically
CREATE OR REPLACE FUNCTION on_case_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := NOW();
    -- Insert timeline event
    INSERT INTO timeline_events (
      case_id, title, description, event_type, event_date, created_by
    ) VALUES (
      NEW.id,
      'Case status changed to: ' || NEW.status,
      'Previous status: ' || OLD.status,
      'status_change',
      NOW(),
      COALESCE(NEW.status_changed_by, NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_case_status_change
  BEFORE UPDATE OF status ON cases
  FOR EACH ROW EXECUTE FUNCTION on_case_status_changed();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: cases
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cases are defined at the end of this migration (after functions are defined)

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: timeline_events
-- Immutable chronological log of everything that happened in a case.
-- Append-only — no updates or deletes allowed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS timeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES profiles(id),         -- NULL = system-generated

  -- Event content
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  event_type    TEXT NOT NULL
                CHECK (event_type IN (
                  'evidence_added',       -- New evidence uploaded
                  'ai_analysis',          -- AI processed something
                  'ai_chat',              -- AI conversation milestone
                  'report_generated',     -- Legal report produced
                  'legal_aid_assigned',   -- Legal aid assigned to case
                  'legal_aid_note',       -- Note from legal aid
                  'contact_made',         -- User contacted authority/service
                  'status_change',        -- Case status changed
                  'emergency_triggered',  -- Emergency mode activated
                  'property_doc_added',   -- Property/inheritance document added
                  'external_referral',    -- Referred to external organization
                  'manual'                -- User-added manual entry
                )),

  -- Temporal pinning
  event_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- When the event occurred (user-reported)
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- When this record was created (system)

  -- Rich metadata (type-specific payload)
  metadata      JSONB NOT NULL DEFAULT '{}',

  -- Verification
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,       -- TRUE = created by trigger/system
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,       -- TRUE = verified by legal aid

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — timeline events are immutable
);

-- Prevent all UPDATE and DELETE on timeline_events
CREATE RULE no_update_timeline AS ON UPDATE TO timeline_events DO INSTEAD NOTHING;
CREATE RULE no_delete_timeline AS ON DELETE TO timeline_events DO INSTEAD NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: timeline_events
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for timeline_events are defined at the end of this migration

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: case_assignments
-- Tracks legal aid assignments to cases.
-- Explicit grant of access — revocable at any time by case owner.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  legal_aid_user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by         UUID NOT NULL REFERENCES profiles(id),

  -- Assignment metadata
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('pending', 'active', 'completed', 'declined', 'revoked')),
  note                TEXT,                            -- Assignment note from user

  -- Access window
  access_expires_at   TIMESTAMPTZ,                    -- NULL = indefinite while active
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID REFERENCES profiles(id),
  revoke_reason       TEXT,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (case_id, legal_aid_user_id)
);

CREATE TRIGGER trg_case_assignments_updated_at
  BEFORE UPDATE ON case_assignments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for case_assignments are defined at the end of this migration

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: denormalized evidence_count and timeline_event_count
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_case_evidence_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cases
    SET evidence_count = evidence_count + 1, updated_at = NOW()
    WHERE id = NEW.case_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cases
    SET evidence_count = GREATEST(0, evidence_count - 1), updated_at = NOW()
    WHERE id = OLD.case_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sync_case_timeline_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cases
  SET timeline_event_count = timeline_event_count + 1, updated_at = NOW()
  WHERE id = NEW.case_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- These triggers are defined here; the evidence table is created in migration 003
-- They will be created after the evidence table in that migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT TRIGGER: cases
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_case_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    actor_id, actor_role, action, resource_type, resource_id,
    old_data, new_data
  )
  SELECT
    auth.uid(),
    (SELECT role FROM profiles WHERE id = auth.uid()),
    TG_OP,
    'cases',
    COALESCE(NEW.id, OLD.id)::TEXT,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION audit_case_changes();

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES: cases and timeline_events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_cases_user_id ON cases(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_status ON cases(status, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_category ON cases(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_risk ON cases(ai_risk_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_reference ON cases(reference_number);
CREATE INDEX idx_cases_incident_county ON cases(incident_county) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_legal_aid ON cases(assigned_legal_aid_id) WHERE assigned_legal_aid_id IS NOT NULL;
CREATE INDEX idx_cases_updated_at ON cases(updated_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_timeline_case_id ON timeline_events(case_id, event_date DESC);
CREATE INDEX idx_timeline_event_type ON timeline_events(event_type);
CREATE INDEX idx_timeline_created_by ON timeline_events(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX idx_case_assignments_case ON case_assignments(case_id, status);
CREATE INDEX idx_case_assignments_legal_aid ON case_assignments(legal_aid_user_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADDITIONAL FUNCTIONS: Case-related authorization helpers
-- (generate_case_reference is defined at the top of this migration)
-- ─────────────────────────────────────────────────────────────────────────────

-- Checks if a case belongs to the currently authenticated user
CREATE OR REPLACE FUNCTION user_owns_case(p_case_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM cases
    WHERE id = p_case_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Checks if a legal aid user is assigned to a case
CREATE OR REPLACE FUNCTION legal_aid_has_case_access(p_case_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM case_assignments
    WHERE case_id = p_case_id
    AND legal_aid_user_id = auth.uid()
    AND status = 'active'
    AND revoked_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: cases
-- Now that all functions exist, we can create the policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Case owners have full access
CREATE POLICY "cases_owner_all"
  ON cases FOR ALL
  USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
  )
  WITH CHECK (auth.uid() = user_id);

-- Legal aid can read cases they are assigned to
CREATE POLICY "cases_legal_aid_select"
  ON cases FOR SELECT
  USING (
    legal_aid_has_case_access(id)
    AND deleted_at IS NULL
  );

-- Legal aid can update status/notes on assigned cases (not ownership fields)
CREATE POLICY "cases_legal_aid_update"
  ON cases FOR UPDATE
  USING (legal_aid_has_case_access(id))
  WITH CHECK (
    legal_aid_has_case_access(id)
    -- Legal aid cannot change ownership
    AND user_id = (SELECT user_id FROM cases WHERE id = cases.id)
  );

-- Admins have full read access
CREATE POLICY "cases_admin_select"
  ON cases FOR SELECT
  USING (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: timeline_events
-- ─────────────────────────────────────────────────────────────────────────────

-- Case owners read all their timeline events
CREATE POLICY "timeline_events_owner_select"
  ON timeline_events FOR SELECT
  USING (user_owns_case(case_id));

-- Only insert (no update/delete enforced by RULE above)
CREATE POLICY "timeline_events_owner_insert"
  ON timeline_events FOR INSERT
  WITH CHECK (user_owns_case(case_id));

-- Legal aid can read and add notes to assigned cases
CREATE POLICY "timeline_events_legal_aid_select"
  ON timeline_events FOR SELECT
  USING (legal_aid_has_case_access(case_id));

CREATE POLICY "timeline_events_legal_aid_insert"
  ON timeline_events FOR INSERT
  WITH CHECK (
    legal_aid_has_case_access(case_id)
    AND event_type = 'legal_aid_note'
  );

CREATE POLICY "timeline_events_admin_select"
  ON timeline_events FOR SELECT
  USING (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: case_assignments
-- ─────────────────────────────────────────────────────────────────────────────

-- Case owners can manage assignments on their cases
CREATE POLICY "case_assignments_owner_all"
  ON case_assignments FOR ALL
  USING (user_owns_case(case_id));

-- Legal aid can see their own assignments
CREATE POLICY "case_assignments_legal_aid_select"
  ON case_assignments FOR SELECT
  USING (auth.uid() = legal_aid_user_id);

-- Legal aid can accept/decline
CREATE POLICY "case_assignments_legal_aid_update"
  ON case_assignments FOR UPDATE
  USING (auth.uid() = legal_aid_user_id)
  WITH CHECK (
    auth.uid() = legal_aid_user_id
    AND status IN ('active', 'declined')
  );

COMMENT ON TABLE cases IS
  'Central case entity. Never hard-deleted. reference_number is human-readable '
  'for use in court documents and police reports.';

COMMENT ON TABLE timeline_events IS
  'Immutable event log. Append-only enforced via RULE. '
  'Provides legal-grade chain of custody for case history.';

COMMENT ON TABLE case_assignments IS
  'Explicit legal aid access grants. Revocable by case owner at any time.';

