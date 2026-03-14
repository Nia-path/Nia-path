// src/app/api/emergency/location/route.ts
// Feature 3: Emergency location updates

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LocationUpdateRequest } from "@/types/extensions";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: LocationUpdateRequest = await req.json();

    // Validate session belongs to user
    const { data: session, error: sessErr } = await supabase
      .from("emergency_sessions")
      .select("id, user_id, ended_at")
      .eq("id", body.session_id)
      .eq("user_id", user.id)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.ended_at) {
      return NextResponse.json({ error: "Session already ended" }, { status: 409 });
    }

    // Insert location point
    const { data: location, error: insertErr } = await supabase
      .from("emergency_locations")
      .insert({
        session_id: body.session_id,
        user_id: user.id,
        lat: body.lat,
        lng: body.lng,
        accuracy_m: body.accuracy_m ?? null,
        altitude_m: body.altitude_m ?? null,
        heading_deg: body.heading_deg ?? null,
        speed_ms: body.speed_ms ?? null,
        battery_level: body.battery_level ?? null,
        device_type: body.device_type ?? "GPS",
        captured_at: new Date().toISOString(),
      })
      .select("id, lat, lng, google_maps_url, captured_at")
      .single();

    if (insertErr) throw insertErr;

    // Also update session with latest coords
    await supabase
      .from("emergency_sessions")
      .update({
        location_lat: body.lat,
        location_lng: body.lng,
        location_accuracy_m: body.accuracy_m ?? null,
      })
      .eq("id", body.session_id);

    return NextResponse.json({ success: true, location });
  } catch (err) {
    console.error("[emergency/location]", err);
    return NextResponse.json({ error: "Failed to store location" }, { status: 500 });
  }
}
