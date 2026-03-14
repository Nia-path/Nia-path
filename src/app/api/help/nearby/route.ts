// src/app/api/help/nearby/route.ts
// Feature 5: Nearby help services with geolocation

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");
    const radius = parseFloat(searchParams.get("radius") ?? "30");
    const type = searchParams.get("type") ?? null;
    const emergency = searchParams.get("emergency") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("get_nearby_help_services", {
      user_lat: lat,
      user_lng: lng,
      radius_km: radius,
      service_type: type,
      emergency_only: emergency,
      result_limit: limit,
    });

    if (error) throw error;

    // Log search for analytics (non-blocking)
    Promise.resolve(
      supabase
        .from("service_searches")
        .insert({
          user_id: user.id,
          search_lat: lat,
          search_lng: lng,
          radius_km: radius,
          service_type: type ?? null,
          results_count: (data ?? []).length,
        })
    ).catch(() => {
      // error - silently ignore
    });

    return NextResponse.json({
      success: true,
      services: data ?? [],
      count: (data ?? []).length,
      search: { lat, lng, radius_km: radius, type, emergency_only: emergency },
    });
  } catch (err) {
    console.error("[help/nearby]", err);
    return NextResponse.json({ error: "Failed to fetch nearby services" }, { status: 500 });
  }
}
