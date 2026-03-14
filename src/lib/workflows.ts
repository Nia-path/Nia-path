// src/lib/workflows.ts
// Unified frontend library for triggering n8n automation workflows.
// All calls go through the Next.js API route → Supabase Edge Function → n8n.
// The service role key is NEVER used in this file — it stays server-side.

type WorkflowEvent =
  | "emergency_sos"
  | "silent_distress"
  | "ai_risk_escalation"
  | "evidence_uploaded"
  | "case_status_update"
  | "report_requested";

interface TriggerResult {
  success: boolean;
  event: WorkflowEvent;
  log_id?: string;
  execution_id?: string;
  error?: string;
}

async function triggerWorkflow(
  event: WorkflowEvent,
  data: Record<string, unknown>
): Promise<TriggerResult> {
  try {
    const res = await fetch("/api/trigger-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error(`[workflows] ${event} failed:`, result);
      return { success: false, event, error: result.error };
    }

    return { success: true, event, ...result };
  } catch (err) {
    console.error(`[workflows] ${event} network error:`, err);
    return { success: false, event, error: "Network error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Named helpers — one per workflow
// ─────────────────────────────────────────────────────────────────────────────

export async function triggerEmergencySOS(payload: {
  session_id: string;
  lat: number | null;
  lng: number | null;
  contacts: Array<{ name: string; phone: string; relationship: string }>;
  timestamp?: string;
}) {
  return triggerWorkflow("emergency_sos", {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export async function triggerSilentDistress(payload: {
  session_id?: string;
  lat: number | null;
  lng: number | null;
  tap_count: number;
}) {
  return triggerWorkflow("silent_distress", {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export async function triggerAiRiskEscalation(payload: {
  message_id: string;
  conversation_id: string;
  case_id?: string;
  risk_level: "high" | "critical";
  immediate_danger: boolean;
  content: string;
  recommended_steps: string[];
}) {
  return triggerWorkflow("ai_risk_escalation", payload);
}

export async function triggerEvidenceUploaded(payload: {
  evidence_id: string;
  case_id: string;
  evidence_type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  storage_bucket: string;
  checksum_sha256?: string;
}) {
  return triggerWorkflow("evidence_uploaded", payload);
}

export async function triggerCaseStatusUpdate(payload: {
  case_id: string;
  old_status: string;
  new_status: string;
  reference_number?: string;
  changed_by?: string;
}) {
  return triggerWorkflow("case_status_update", payload);
}

export async function triggerReportRequested(payload: {
  case_id: string;
  report_type: string;
}) {
  return triggerWorkflow("report_requested", payload);
}