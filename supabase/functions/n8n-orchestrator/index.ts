// supabase/functions/n8n-orchestrator/index.ts
// Supabase Edge Function — routes events to n8n workflows
// Deploy: supabase functions deploy n8n-orchestrator

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const N8N_WEBHOOKS: Record<string, string> = {
  case_created:           Deno.env.get("N8N_WEBHOOK_CASE_CREATED")!,
  evidence_uploaded:      Deno.env.get("N8N_WEBHOOK_EVIDENCE_UPLOADED")!,
  emergency_alert:        Deno.env.get("N8N_WEBHOOK_EMERGENCY_ALERT")!,
  report_requested:       Deno.env.get("N8N_WEBHOOK_REPORT_REQUESTED")!,
  check_in_overdue:       Deno.env.get("N8N_WEBHOOK_CHECK_IN_OVERDUE")!,
  legal_aid_assigned:     Deno.env.get("N8N_WEBHOOK_LEGAL_AID_ASSIGNED")!,
  case_escalated:         Deno.env.get("N8N_WEBHOOK_CASE_ESCALATED")!,
  report_generated:       Deno.env.get("N8N_WEBHOOK_REPORT_GENERATED")!,
};

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  user_id?: string;
  timestamp: string;
}

serve(async (req: Request) => {
  // Verify the request comes from within Supabase (service role)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload: WebhookPayload = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const webhookUrl = N8N_WEBHOOKS[payload.event];
  if (!webhookUrl) {
    return new Response(JSON.stringify({ error: `Unknown event: ${payload.event}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Log the webhook attempt
  const { data: logEntry } = await supabase
    .from("n8n_webhook_log")
    .insert({
      webhook_name: payload.event,
      webhook_url: webhookUrl,
      payload: payload.data,
      status: "pending",
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nia-Event": payload.event,
        "X-Nia-Timestamp": payload.timestamp,
        "X-Nia-User-Id": payload.user_id ?? "",
      },
      body: JSON.stringify({
        event: payload.event,
        data: payload.data,
        timestamp: payload.timestamp,
        user_id: payload.user_id,
      }),
    });

    const responseText = await response.text();
    let executionId: string | undefined;

    try {
      const responseJson = JSON.parse(responseText);
      executionId = responseJson.executionId;
    } catch { /* ignore parse error */ }

    // Update log with result
    if (logEntry?.id) {
      await supabase
        .from("n8n_webhook_log")
        .update({
          status: response.ok ? "sent" : "failed",
          response_status: response.status,
          response_body: responseText.slice(0, 1000),
          execution_id: executionId,
        })
        .eq("id", logEntry.id);
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        event: payload.event,
        execution_id: executionId,
        http_status: response.status,
      }),
      {
        status: response.ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Update log with error
    if (logEntry?.id) {
      await supabase
        .from("n8n_webhook_log")
        .update({
          status: "failed",
          response_body: error instanceof Error ? error.message : "Unknown error",
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Retry in 5min
        })
        .eq("id", logEntry.id);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Webhook delivery failed", event: payload.event }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
});
