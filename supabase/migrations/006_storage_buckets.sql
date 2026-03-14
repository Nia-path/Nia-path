-- =============================================================================
-- MIGRATION 006: SUPABASE STORAGE BUCKET ARCHITECTURE
-- =============================================================================
-- Storage is organized into 4 buckets with strict isolation:
--
--  evidence-private   → User-uploaded evidence (photos, audio, video, docs)
--                       Private. User can only access own folder.
--                       Path: {user_id}/{case_id}/{uuid}.{ext}
--
--  property-docs      → Land titles, marriage certs, legal documents
--                       Private. Stricter file type controls.
--                       Path: {user_id}/{uuid}.{ext}
--
--  reports            → Generated legal reports (PDFs)
--                       Private. Read-only after generation.
--                       Path: {user_id}/{case_id}/{report_id}.pdf
--
--  avatars            → User profile photos
--                       Public bucket (blurred/pseudonymous)
--                       Path: {user_id}/avatar.{ext}
--
-- SECURITY DESIGN:
--  • All evidence buckets are PRIVATE (no public URLs)
--  • Files accessed via signed URLs (expire in 1 hour)
--  • Storage paths include user_id to prevent path traversal
--  • File type validation at both storage and application layers
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET CREATION
-- Run via Supabase Dashboard or management API
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: Execute these as the postgres superuser or via Supabase Dashboard

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-private',
  'evidence-private',
  FALSE,                    -- PRIVATE — never make public
  52428800,                 -- 50MB per file
  ARRAY[
    -- Images
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    -- Video
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/3gpp',
    -- Audio
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg',
    -- Documents
    'application/pdf', 'text/plain',
    -- Office docs (for screenshots of messages)
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-docs',
  'property-docs',
  FALSE,                    -- PRIVATE
  20971520,                 -- 20MB per file (documents only, smaller limit)
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  FALSE,                    -- PRIVATE
  10485760,                 -- 10MB (PDFs only)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,                     -- PUBLIC — profile photos only
  2097152,                  -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE RLS POLICIES: evidence-private
-- Path structure: {user_id}/{case_id}/{uuid}.{ext}
-- ─────────────────────────────────────────────────────────────────────────────

-- Users can upload to their own folder only
CREATE POLICY "evidence_private_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'evidence-private'
    -- First path segment must be their user_id
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    -- Prevent path traversal
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '%//%'
    AND OCTET_LENGTH(name) < 500
  );

-- Users can read their own evidence files
CREATE POLICY "evidence_private_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence-private'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Legal aid can read evidence for assigned cases
-- The case_id is the second path segment: {user_id}/{case_id}/...
CREATE POLICY "evidence_private_select_legal_aid"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence-private'
    AND EXISTS (
      SELECT 1
      FROM case_assignments ca
      JOIN cases c ON c.id = ca.case_id
      WHERE ca.legal_aid_user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.revoked_at IS NULL
        -- Match the case_id path segment
        AND c.id::TEXT = (storage.foldername(name))[2]
    )
  );

-- Users can delete their own evidence (soft-delete preferred, but allow storage cleanup)
CREATE POLICY "evidence_private_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'evidence-private'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE RLS POLICIES: property-docs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "property_docs_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND name NOT LIKE '%..%'
  );

CREATE POLICY "property_docs_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'property-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "property_docs_legal_aid_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'property-docs'
    AND EXISTS (
      SELECT 1
      FROM case_assignments ca
      JOIN property_documents pd ON pd.case_id = ca.case_id
      JOIN evidence e ON e.storage_path = name
      WHERE ca.legal_aid_user_id = auth.uid()
        AND ca.status = 'active'
        AND pd.user_id = (storage.foldername(name))[1]::UUID
    )
  );

CREATE POLICY "property_docs_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE RLS POLICIES: reports
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "reports_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "reports_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "reports_legal_aid_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1
      FROM legal_reports lr
      JOIN case_assignments ca ON ca.case_id = lr.case_id
      WHERE ca.legal_aid_user_id = auth.uid()
        AND ca.status = 'active'
        AND lr.storage_path = name
    )
  );

-- No client delete for reports (legal integrity)

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE RLS POLICIES: avatars (public bucket)
-- ─────────────────────────────────────────────────────────────────────────────

-- Anyone can read avatars (public)
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Only update own avatar
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Generate signed URL for private evidence
-- Called by Next.js API routes — never exposed to client directly
-- ─────────────────────────────────────────────────────────────────────────────

-- This is implemented in the Next.js API layer using the Supabase SDK:
-- const { data } = await supabase.storage
--   .from('evidence-private')
--   .createSignedUrl(storagePath, 3600); // 1 hour expiry

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: storage_quota
-- Track per-user storage usage to prevent abuse
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS storage_quota (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_bytes_used      BIGINT NOT NULL DEFAULT 0,
  evidence_bytes        BIGINT NOT NULL DEFAULT 0,
  property_doc_bytes    BIGINT NOT NULL DEFAULT 0,
  report_bytes          BIGINT NOT NULL DEFAULT 0,
  quota_limit_bytes     BIGINT NOT NULL DEFAULT 5368709120,  -- 5GB default
  quota_exceeded        BOOLEAN NOT NULL DEFAULT FALSE,
  last_calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE storage_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_quota_own"
  ON storage_quota FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger: update quota when evidence is added
CREATE OR REPLACE FUNCTION update_storage_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO storage_quota (user_id, total_bytes_used, evidence_bytes)
    VALUES (NEW.user_id, NEW.file_size, NEW.file_size)
    ON CONFLICT (user_id) DO UPDATE SET
      total_bytes_used = storage_quota.total_bytes_used + NEW.file_size,
      evidence_bytes = storage_quota.evidence_bytes + NEW.file_size,
      last_calculated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_storage_quota_evidence
  AFTER INSERT ON evidence
  FOR EACH ROW EXECUTE FUNCTION update_storage_quota();

COMMENT ON TABLE storage_quota IS
  'Per-user storage tracking. Prevents storage abuse and helps with '
  'capacity planning at scale.';
