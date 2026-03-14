// src/app/api/emergency/alert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session_id, lat, lng, contacts } = await req.json();

    // Store emergency session
    const { error: sessionError } = await supabase.from("emergency_sessions").insert({
      id: session_id,
      user_id: user.id,
      location_lat: lat ?? null,
      location_lng: lng ?? null,
      started_at: new Date().toISOString(),
      alert_sent: true,
    });

    if (sessionError) {
      console.error("Failed to store emergency session:", sessionError);
    }

    // Trigger n8n workflow: emergency alert → SMS contacts → create incident record
    const n8nRes = await fetch(process.env.N8N_WEBHOOK_EMERGENCY_ALERT!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id,
        user_id: user.id,
        user_name: user.user_metadata?.full_name ?? "Nia User",
        lat,
        lng,
        google_maps_url: lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null,
        contacts,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      alerts_sent: contacts?.length ?? 0,
    });
  } catch (error) {
    console.error("[Emergency Alert Error]", error);
    return NextResponse.json({ error: "Alert failed" }, { status: 500 });
  }
}
