// src/app/api/trigger-workflow/route.ts
// Next.js API route used by the frontend to fire n8n workflows.


import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type WorkflowEvent =
  | "emergency_sos"
  | "silent_distress"
  | "ai_risk_escalation"
  | "evidence_uploaded"
  | "case_status_update"
  | "report_requested";

interface TriggerPayload {
  event: WorkflowEvent;
  data: Record<string, unknown>;
}

// Rate limiting store (in-memory; use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, event: WorkflowEvent): boolean {
  // Emergency events: 10 per minute
  // Others: 30 per minute
  const limit = event.includes("emergency") || event.includes("distress") ? 10 : 30;
  const windowMs = 60 * 1000;
  const key = `${userId}:${event}`;
  const now = Date.now();

  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { event, data }: TriggerPayload = await req.json();

    if (!event || !data) {
      return NextResponse.json({ error: "Missing event or data" }, { status: 400 });
    }

    // Rate limiting
    if (!checkRateLimit(user.id, event)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Always inject user_id from verified JWT — never trust client-supplied user_id
    const enrichedData = {
      ...data,
      user_id: user.id,
    };

    // Call Supabase Edge Function (server-to-server with service role)
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/n8n-orchestrator`;

    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Service role key — never expose this to the client
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        event,
        data: enrichedData,
        user_id: user.id,
        timestamp: new Date().toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[trigger-workflow] n8n delivery failed for ${event}:`, result);
      return NextResponse.json(
        { error: "Workflow trigger failed", detail: result },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      event,
      log_id: result.log_id,
      execution_id: result.execution_id,
    });
  } catch (err) {
    console.error("[trigger-workflow] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE HELPER: Used by hooks and components
// ─────────────────────────────────────────────────────────────────────────────

// Usage in frontend:
//
// import { triggerWorkflow } from "@/lib/workflows";
//
// await triggerWorkflow("emergency_sos", {
//   session_id: sessionId,
//   lat: coords.latitude,
//   lng: coords.longitude,
//   contacts: user.emergency_contacts,
// });