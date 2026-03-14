-- =============================================================================
-- MIGRATION 003: EVIDENCE VAULT
-- =============================================================================
-- Evidence is the most critical data in the platform.
-- Every piece of evidence must:
--   • Be immutably timestamped at upload
--   • Have its integrity verified via checksum
--   • Be strictly access-controlled to the owner
--   • Support legal chain of custody requirements
--   • Track whether it has been submitted to authorities
--
-- Storage architecture:
--   Supabase Storage (S3-compatible) with three buckets:
--   • evidence-private   → User evidence files (photos, audio, video, docs)
--   • reports            → Generated legal reports (PDF)
--   • property-docs      → Land titles, marriage certs, death certs
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: evidence
-- One row per uploaded file. File itself lives in Supabase Storage.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID REFERENCES cases(id) ON DELETE RESTRICT,  -- Cannot delete case if evidence exists
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- File identity
  type                  TEXT NOT NULL
                        CHECK (type IN (
                          'photo',         -- Image file
                          'video',         -- Video recording
                          'audio',         -- Audio recording
                          'document',      -- PDF/text document
                          'screenshot',    -- Screenshot of message/threat
                          'location',      -- GPS coordinate record (no file)
                          'property_doc'   -- Land title, marriage cert, etc.
                        )),
  file_name             TEXT NOT NULL,               -- Original filename (sanitized)
  storage_bucket        TEXT NOT NULL,               -- Which bucket: 'evidence-private' | 'reports' | 'property-docs'
  storage_path          TEXT NOT NULL UNIQUE,        -- Full path in storage bucket

  -- Derived/display URLs (populated by trigger after upload confirmation)
  file_url              TEXT,                        -- Presigned or public URL
  thumbnail_url         TEXT,                        -- Thumbnail for images/video

  -- File metadata
  mime_type             TEXT NOT NULL,
  file_size             BIGINT NOT NULL CHECK (file_size > 0),
  duration_seconds      INTEGER,                     -- For audio/video
  width                 INTEGER,                     -- For images/video
  height                INTEGER,                     -- For images/video

  -- Evidence description
  description           TEXT,
  tags                  TEXT[] NOT NULL DEFAULT '{}',

  -- Geographic context (where evidence was captured)
  location_lat          DOUBLE PRECISION,
  location_lng          DOUBLE PRECISION,
  location_accuracy_m   DOUBLE PRECISION,           -- GPS accuracy in meters
  location_name         TEXT,                       -- Reverse-geocoded name

  -- Temporal integrity (legal admissibility requires precise timestamps)
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When evidence was created
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When uploaded to platform
  device_timezone       TEXT,                               -- User device timezone

  -- Integrity verification
  checksum_sha256       TEXT NOT NULL,              -- SHA-256 of file contents
  checksum_verified_at  TIMESTAMPTZ,               -- When we verified checksum matches storage
  is_tamper_evident     BOOLEAN NOT NULL DEFAULT TRUE, -- Whether integrity can be verified

  -- Encryption state
  is_client_encrypted   BOOLEAN NOT NULL DEFAULT FALSE, -- Client-side encrypted before upload
  encryption_iv         TEXT,                       -- If client-encrypted

  -- Legal status
  submitted_to_police   BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_to_police_at TIMESTAMPTZ,
  police_ob_number      TEXT,                       -- Occurrence Book number from police

  submitted_to_court    BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_to_court_at TIMESTAMPTZ,
  court_case_number     TEXT,

  -- AI analysis state
  ai_analyzed           BOOLEAN NOT NULL DEFAULT FALSE,
  ai_analysis_at        TIMESTAMPTZ,
  ai_analysis_result    JSONB,                      -- Structured AI analysis output

  -- Soft delete (never purge evidence without explicit legal basis)
  deleted_at            TIMESTAMPTZ,
  deletion_reason       TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_evidence_updated_at
  BEFORE UPDATE ON evidence
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY: evidence
-- The most sensitive RLS in the platform
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Owners have full access to their own evidence
CREATE POLICY "evidence_owner_select"
  ON evidence FOR SELECT
  USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
  );

CREATE POLICY "evidence_owner_insert"
  ON evidence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update description/tags/legal status only
-- Cannot change: file content, checksums, storage paths
CREATE POLICY "evidence_owner_update"
  ON evidence FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = user_id
    -- Immutable fields enforced by trigger (see below)
  );

-- NO DELETE policy — evidence can only be soft-deleted via service role
-- This ensures legal chain of custody is never broken by client code

-- Legal aid can read evidence on assigned cases
CREATE POLICY "evidence_legal_aid_select"
  ON evidence FOR SELECT
  USING (
    legal_aid_has_case_access(case_id)
    AND deleted_at IS NULL
  );

-- Admins can read all evidence (for compliance/support)
CREATE POLICY "evidence_admin_select"
  ON evidence FOR SELECT
  USING (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Prevent tampering with evidence integrity fields
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION protect_evidence_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- These fields must NEVER change after initial insert
  IF OLD.checksum_sha256 IS DISTINCT FROM NEW.checksum_sha256 THEN
    RAISE EXCEPTION 'Evidence checksum cannot be modified after upload (tamper prevention)';
  END IF;
  IF OLD.storage_path IS DISTINCT FROM NEW.storage_path THEN
    RAISE EXCEPTION 'Evidence storage path cannot be modified after upload';
  END IF;
  IF OLD.storage_bucket IS DISTINCT FROM NEW.storage_bucket THEN
    RAISE EXCEPTION 'Evidence storage bucket cannot be modified after upload';
  END IF;
  IF OLD.captured_at IS DISTINCT FROM NEW.captured_at THEN
    RAISE EXCEPTION 'Evidence capture timestamp cannot be modified after upload';
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Evidence ownership cannot be transferred';
  END IF;
  IF OLD.file_size IS DISTINCT FROM NEW.file_size THEN
    RAISE EXCEPTION 'Evidence file size cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evidence_integrity
  BEFORE UPDATE ON evidence
  FOR EACH ROW EXECUTE FUNCTION protect_evidence_integrity();

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Sync evidence count on cases table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_evidence_count_insert
  AFTER INSERT ON evidence
  FOR EACH ROW
  WHEN (NEW.case_id IS NOT NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION sync_case_evidence_count();

CREATE OR REPLACE FUNCTION sync_case_evidence_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Soft delete: decrement on deleted_at set
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.case_id IS NOT NULL THEN
    UPDATE cases
    SET evidence_count = GREATEST(0, evidence_count - 1), updated_at = NOW()
    WHERE id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_evidence_count_soft_delete
  AFTER UPDATE OF deleted_at ON evidence
  FOR EACH ROW EXECUTE FUNCTION sync_case_evidence_count_on_delete();

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Auto-create timeline event when evidence is uploaded
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION on_evidence_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_id IS NOT NULL THEN
    INSERT INTO timeline_events (
      case_id, created_by, title, description,
      event_type, event_date, metadata, is_system
    ) VALUES (
      NEW.case_id,
      NEW.user_id,
      'Evidence added: ' || INITCAP(NEW.type),
      COALESCE(NEW.description, NEW.file_name),
      'evidence_added',
      NEW.captured_at,
      jsonb_build_object(
        'evidence_id', NEW.id,
        'file_name', NEW.file_name,
        'type', NEW.type,
        'file_size', NEW.file_size,
        'has_location', (NEW.location_lat IS NOT NULL)
      ),
      TRUE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_evidence_timeline
  AFTER INSERT ON evidence
  FOR EACH ROW EXECUTE FUNCTION on_evidence_uploaded();

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Audit all evidence operations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_evidence_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    actor_id, action, resource_type, resource_id,
    old_data, new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    'evidence',
    COALESCE(NEW.id, OLD.id)::TEXT,
    CASE WHEN TG_OP != 'INSERT' THEN
      jsonb_build_object('id', OLD.id, 'file_name', OLD.file_name, 'deleted_at', OLD.deleted_at)
    ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN
      jsonb_build_object('id', NEW.id, 'file_name', NEW.file_name, 'type', NEW.type)
    ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_evidence
  AFTER INSERT OR UPDATE OR DELETE ON evidence
  FOR EACH ROW EXECUTE FUNCTION audit_evidence_access();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: evidence_access_log
-- Track every time evidence is accessed (read) for chain of custody
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_access_log (
  id            BIGSERIAL PRIMARY KEY,
  evidence_id   UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  accessed_by   UUID NOT NULL REFERENCES profiles(id),
  access_type   TEXT NOT NULL CHECK (access_type IN ('view', 'download', 'share', 'submit')),
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    INET,
  context       TEXT                                  -- Why accessed (e.g., 'court submission')
);

ALTER TABLE evidence_access_log ENABLE ROW LEVEL SECURITY;

-- Owners can see who accessed their evidence
CREATE POLICY "evidence_access_log_owner_select"
  ON evidence_access_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM evidence e
      WHERE e.id = evidence_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "evidence_access_log_insert"
  ON evidence_access_log FOR INSERT
  WITH CHECK (auth.uid() = accessed_by);

CREATE INDEX idx_evidence_access_evidence_id ON evidence_access_log(evidence_id, accessed_at DESC);
CREATE INDEX idx_evidence_access_user ON evidence_access_log(accessed_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: property_documents
-- Specialized table for property rights and inheritance cases
-- Stores structured metadata about legal property documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  evidence_id           UUID REFERENCES evidence(id),  -- Link to the uploaded file

  -- Document classification
  document_type         TEXT NOT NULL
                        CHECK (document_type IN (
                          'land_title',
                          'title_deed',
                          'marriage_certificate',
                          'death_certificate',
                          'birth_certificate',
                          'succession_certificate',
                          'court_order',
                          'affidavit',
                          'sale_agreement',
                          'lease_agreement',
                          'will_testament',
                          'other'
                        )),

  -- Property details
  property_description  TEXT,
  land_reference_number TEXT,                          -- LR Number / Plot Number
  county_location       TEXT,
  sub_county_location   TEXT,

  -- Parties involved
  registered_owner      TEXT,                          -- Name on title
  claimant_name         TEXT,                          -- User's name / claim
  relationship_to_owner TEXT,                          -- e.g., spouse, child

  -- Document status
  is_original           BOOLEAN NOT NULL DEFAULT FALSE,
  is_certified_copy     BOOLEAN NOT NULL DEFAULT FALSE,
  document_date         DATE,
  expiry_date           DATE,
  issuing_authority     TEXT,

  -- AI assistance
  ai_extracted_data     JSONB,                         -- AI-extracted fields from document
  ai_rights_assessment  TEXT,                          -- AI summary of legal rights
  ai_recommended_steps  TEXT[],

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_property_docs_updated_at
  BEFORE UPDATE ON property_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_docs_owner_all"
  ON property_documents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "property_docs_legal_aid_select"
  ON property_documents FOR SELECT
  USING (legal_aid_has_case_access(case_id));

CREATE INDEX idx_property_docs_case ON property_documents(case_id);
CREATE INDEX idx_property_docs_user ON property_documents(user_id);
CREATE INDEX idx_property_docs_type ON property_documents(document_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES: evidence
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_evidence_case_id ON evidence(case_id, captured_at DESC)
  WHERE case_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_evidence_user_id ON evidence(user_id, captured_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_type ON evidence(type, user_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_storage_path ON evidence(storage_path);
CREATE INDEX idx_evidence_checksum ON evidence(checksum_sha256);
CREATE INDEX idx_evidence_submitted ON evidence(submitted_to_police, submitted_to_court)
  WHERE submitted_to_police = TRUE OR submitted_to_court = TRUE;
CREATE INDEX idx_evidence_ai_pending ON evidence(id)
  WHERE ai_analyzed = FALSE AND deleted_at IS NULL;

COMMENT ON TABLE evidence IS
  'Secure evidence vault. Files stored in Supabase Storage. '
  'Integrity protected by immutable checksums and tamper-prevention triggers. '
  'Never hard-delete — soft delete only.';

COMMENT ON COLUMN evidence.checksum_sha256 IS
  'SHA-256 hash of file contents. Computed client-side before upload AND '
  'verified server-side after storage. Mismatch indicates tampering.';
