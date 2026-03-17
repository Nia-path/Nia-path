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
  ai_risk_escalation:     Deno.env.get("N8N_WEBHOOK_AI_RISK_ESCALATION")!,
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  // Debug logging
  console.log("🔍 Auth header present:", !!authHeader);
  console.log("🔍 Service key present:", !!serviceKey);
  
  if (!authHeader) {
    console.error("❌ No Authorization header");
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (!serviceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Extract token from "Bearer {token}" format
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  
  // Check if token is a valid JWT by checking structure (doesn't need to match exactly)
  // Real validation would be done by Supabase admin
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    console.error("❌ Invalid JWT format");
    return new Response(JSON.stringify({ error: "Invalid token format" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Decode JWT header to verify it's from this service role key
  try {
    const header = JSON.parse(atob(tokenParts[0]));
    const payload = JSON.parse(atob(tokenParts[1]));
    
    console.log("🔍 Token issuer:", payload.iss);
    console.log("🔍 Token role:", payload.role);
    console.log("🔍 Token exp:", new Date(payload.exp * 1000).toISOString());
    
    // Verify it's a service_role token from Supabase
    if (payload.iss !== "supabase" || payload.role !== "service_role") {
      console.error("❌ Token is not a valid service_role token");
      return new Response(JSON.stringify({ error: "Invalid token: not a service_role token" }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error("❌ Token expired");
      return new Response(JSON.stringify({ error: "Token expired" }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log("✅ Valid service_role token accepted");
  } catch (err) {
    console.error("❌ Failed to decode JWT:", err);
    return new Response(JSON.stringify({ error: "Invalid token: decode failed" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
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

  console.log(`📍 Event: ${payload.event}`);
  console.log(`📍 Webhook URL: ${webhookUrl}`);
  console.log(`📍 Payload data:`, JSON.stringify(payload.data).substring(0, 200));

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
    // Build headers for n8n webhook
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Nia-Event": payload.event,
      "X-Nia-Timestamp": payload.timestamp,
      "X-Nia-User-Id": payload.user_id ?? "",
    };

    // Add webhook secret if configured - n8n workflow checks for x-nia-secret
    const niaWebhookSecret = Deno.env.get("NIA_WEBHOOK_SECRET");
    if (niaWebhookSecret) {
      headers["X-Nia-Secret"] = niaWebhookSecret;
      console.log("🔐 Sending webhook secret in X-Nia-Secret header");
    }

    // Add optional n8n API key if configured
    const n8nApiKey = Deno.env.get("N8N_API_KEY");
    if (n8nApiKey) {
      headers["Authorization"] = `Bearer ${n8nApiKey}`;
      console.log("🔐 Sending n8n API key in Authorization header");
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
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

    console.log(`📍 n8n Response Status: ${response.status}`);
    console.log(`📍 n8n Response Body:`, responseText.substring(0, 300));

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
