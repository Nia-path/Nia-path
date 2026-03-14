-- =============================================================================
-- MIGRATION 004: AI CONVERSATIONS AND EMERGENCY SYSTEM
-- =============================================================================
-- Stores all AI Justice Advisor conversations and Emergency Mode sessions.
--
-- Design decisions:
-- • Conversations are stored per-session, not per-case (user may chat before
--   creating a case, and one chat may lead to multiple cases)
-- • Messages are append-only — never updated or deleted by clients
-- • Emergency sessions capture a complete snapshot of what happened
-- • All emergency data is immediately replicated to timeline events
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: ai_conversations
-- Groups messages into sessions. One session = one continuous chat.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id             UUID REFERENCES cases(id) ON DELETE SET NULL, -- Linked case (may be null initially)

  -- Session metadata
  session_title       TEXT,                             -- Auto-generated or user-named
  language            TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'sw')),

  -- AI analysis of this conversation
  ai_case_category    TEXT CHECK (ai_case_category IN (
    'domestic_violence', 'sexual_harassment', 'workplace_discrimination',
    'property_rights', 'child_custody', 'financial_abuse', 'gbv_other', 'other'
  )),
  ai_risk_level       TEXT CHECK (ai_risk_level IN ('low', 'medium', 'high', 'critical')),
  ai_immediate_danger BOOLEAN NOT NULL DEFAULT FALSE,
  ai_summary          TEXT,                             -- Summary of conversation
  ai_action_items     JSONB NOT NULL DEFAULT '[]',      -- Recommended next steps

  -- Message stats (denormalized)
  message_count       INTEGER NOT NULL DEFAULT 0,
  last_message_at     TIMESTAMPTZ,

  -- Session state
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  ended_at            TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_owner_all"
  ON ai_conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "ai_conversations_legal_aid_select"
  ON ai_conversations FOR SELECT
  USING (
    legal_aid_has_case_access(case_id)
    AND case_id IS NOT NULL
  );

CREATE INDEX idx_ai_conv_user ON ai_conversations(user_id, created_at DESC);
CREATE INDEX idx_ai_conv_case ON ai_conversations(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_ai_conv_risk ON ai_conversations(ai_risk_level)
  WHERE ai_risk_level IN ('high', 'critical');

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: ai_messages
-- Individual messages in an AI conversation. Append-only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Message content
  role                TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content             TEXT NOT NULL,
  content_language    TEXT NOT NULL DEFAULT 'en',

  -- AI-specific fields (populated for assistant messages)
  model_used          TEXT,                              -- e.g., 'gpt-4o-mini'
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  latency_ms          INTEGER,

  -- Structured response data (for assistant messages)
  case_category       TEXT,
  risk_level          TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  immediate_danger    BOOLEAN,
  recommended_steps   TEXT[],
  suggested_actions   JSONB NOT NULL DEFAULT '[]',       -- Action buttons rendered in UI

  -- Sequence
  sequence_number     INTEGER NOT NULL,                  -- 1-based ordering within conversation

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — messages are immutable
);

-- Prevent modification of existing messages
CREATE RULE no_update_ai_messages AS ON UPDATE TO ai_messages DO INSTEAD NOTHING;
CREATE RULE no_delete_ai_messages AS ON DELETE TO ai_messages DO INSTEAD NOTHING;

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_owner_all"
  ON ai_messages FOR ALL
  USING (auth.uid() = user_id);

-- Allow insert for service role (AI responses written server-side)
-- Client can only insert user messages
CREATE POLICY "ai_messages_owner_insert"
  ON ai_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'user'  -- Clients can only insert user messages; assistant messages written by API
  );

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, sequence_number);
CREATE INDEX idx_ai_messages_user ON ai_messages(user_id, created_at DESC);
CREATE INDEX idx_ai_messages_risk ON ai_messages(risk_level)
  WHERE risk_level IN ('high', 'critical') AND role = 'assistant';

-- Trigger: update conversation stats when message added
CREATE OR REPLACE FUNCTION on_ai_message_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    -- Update risk from latest assistant message
    ai_risk_level = CASE
      WHEN NEW.role = 'assistant' AND NEW.risk_level IS NOT NULL THEN NEW.risk_level
      ELSE ai_risk_level
    END,
    ai_immediate_danger = CASE
      WHEN NEW.role = 'assistant' AND NEW.immediate_danger IS NOT NULL THEN NEW.immediate_danger
      ELSE ai_immediate_danger
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ai_message_inserted
  AFTER INSERT ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION on_ai_message_inserted();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: emergency_sessions
-- Records each activation of Emergency Mode.
-- This is time-critical data — optimized for fast writes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS emergency_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id               UUID REFERENCES cases(id) ON DELETE SET NULL,

  -- Session timing
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ,
  duration_seconds      INTEGER GENERATED ALWAYS AS (
                          EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
                        ) STORED,

  -- Trigger context
  trigger_type          TEXT NOT NULL DEFAULT 'manual'
                        CHECK (trigger_type IN (
                          'manual',           -- User pressed SOS button
                          'shake_gesture',    -- Device shake detection
                          'voice_command',    -- "Help me" voice trigger
                          'scheduled_check',  -- Missed check-in
                          'auto_detect'       -- AI detected danger in conversation
                        )),

  -- Location at activation
  location_lat          DOUBLE PRECISION,
  location_lng          DOUBLE PRECISION,
  location_accuracy_m   DOUBLE PRECISION,
  location_name         TEXT,
  google_maps_url       TEXT GENERATED ALWAYS AS (
                          CASE WHEN location_lat IS NOT NULL AND location_lng IS NOT NULL
                          THEN 'https://maps.google.com/?q=' || location_lat::TEXT || ',' || location_lng::TEXT
                          ELSE NULL END
                        ) STORED,

  -- Alert status
  alert_sent            BOOLEAN NOT NULL DEFAULT FALSE,
  alert_sent_at         TIMESTAMPTZ,
  contacts_alerted      JSONB NOT NULL DEFAULT '[]',   -- Array of {name, phone, method, sent_at}
  sms_provider_response JSONB,                          -- Response from SMS gateway

  -- Evidence captured during session
  audio_recordings      JSONB NOT NULL DEFAULT '[]',    -- Array of {storage_path, duration_s, captured_at}
  photos_captured       JSONB NOT NULL DEFAULT '[]',    -- Array of {storage_path, captured_at}

  -- Outcome
  outcome               TEXT CHECK (outcome IN (
                          'resolved_safe',  -- User confirmed they are safe
                          'police_called',  -- Police were called
                          'shelter_found',  -- User went to shelter
                          'ongoing',        -- Session ended without resolution
                          'unknown'
                        )),
  outcome_note          TEXT,

  -- n8n workflow tracking
  n8n_execution_id      TEXT,                           -- n8n workflow execution ID for tracing
  workflow_completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_emergency_sessions_updated_at
  BEFORE UPDATE ON emergency_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE emergency_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_sessions_owner_all"
  ON emergency_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "emergency_sessions_admin_select"
  ON emergency_sessions FOR SELECT
  USING (is_platform_admin());

CREATE INDEX idx_emergency_user ON emergency_sessions(user_id, started_at DESC);
CREATE INDEX idx_emergency_alert_pending ON emergency_sessions(id)
  WHERE alert_sent = FALSE AND ended_at IS NULL;
CREATE INDEX idx_emergency_case ON emergency_sessions(case_id) WHERE case_id IS NOT NULL;

-- Trigger: auto-create case and timeline event on emergency activation
CREATE OR REPLACE FUNCTION on_emergency_session_started()
RETURNS TRIGGER AS $$
DECLARE
  v_case_id UUID;
BEGIN
  -- If no case linked, create an emergency case
  IF NEW.case_id IS NULL THEN
    INSERT INTO cases (
      user_id, title, description, category, status,
      incident_county, ai_risk_level
    )
    VALUES (
      NEW.user_id,
      'Emergency – ' || TO_CHAR(NEW.started_at, 'DD Mon YYYY HH24:MI'),
      'Case created automatically from emergency mode activation.',
      'gbv_other',
      'escalated',
      NULL,
      'critical'
    )
    RETURNING id INTO v_case_id;

    -- Link session to new case
    UPDATE emergency_sessions SET case_id = v_case_id WHERE id = NEW.id;
    NEW.case_id := v_case_id;
  ELSE
    v_case_id := NEW.case_id;
    -- Escalate existing case
    UPDATE cases SET status = 'escalated', ai_risk_level = 'critical', updated_at = NOW()
    WHERE id = v_case_id AND ai_risk_level != 'critical';
  END IF;

  -- Insert emergency timeline event
  INSERT INTO timeline_events (
    case_id, created_by, title, description, event_type, event_date, metadata, is_system
  ) VALUES (
    v_case_id,
    NEW.user_id,
    'Emergency mode activated',
    'User activated SOS emergency mode. Location capture and recording initiated.',
    'emergency_triggered',
    NEW.started_at,
    jsonb_build_object(
      'session_id', NEW.id,
      'trigger_type', NEW.trigger_type,
      'has_location', (NEW.location_lat IS NOT NULL),
      'google_maps_url', NEW.google_maps_url
    ),
    TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_emergency_started
  AFTER INSERT ON emergency_sessions
  FOR EACH ROW EXECUTE FUNCTION on_emergency_session_started();

-- Trigger: audit all emergency events
CREATE OR REPLACE FUNCTION audit_emergency_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, resource_type, resource_id, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    'emergency_sessions',
    NEW.id::TEXT,
    jsonb_build_object(
      'id', NEW.id,
      'started_at', NEW.started_at,
      'alert_sent', NEW.alert_sent,
      'trigger_type', NEW.trigger_type
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_emergency
  AFTER INSERT OR UPDATE ON emergency_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_emergency_session();

COMMENT ON TABLE ai_conversations IS
  'AI Justice Advisor conversation sessions. Append-only messages. '
  'Linked to cases when a case is created from the conversation.';

COMMENT ON TABLE emergency_sessions IS
  'Emergency mode activations. Each row captures the complete context '
  'of one SOS activation, including location, recordings, and contacts alerted.';
