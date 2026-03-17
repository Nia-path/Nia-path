// src/app/api/help/nearby/route.ts
// Feature 5: Nearby help services with geolocation

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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
    } as any);

    if (error) throw error;

    const services = data as Array<{
      id: string;
      name: string;
      address: string;
      phone: string | null;
      website: string | null;
      latitude: number;
      longitude: number;
      distance_km: number;
      service_type: string;
      is_emergency: boolean;
    }> | null;

    // Log search for analytics (non-blocking)
    const insertData: Database["public"]["Tables"]["service_searches"]["Insert"] = {
      user_id: user.id,
      search_lat: lat,
      search_lng: lng,
      radius_km: radius,
      service_type: type ?? null,
      results_count: (services ?? []).length,
    };
    
    Promise.resolve(
      (supabase.from("service_searches") as any).insert([insertData])
    ).catch(() => {
      // error - silently ignore
    });

    return NextResponse.json({
      success: true,
      services: services ?? [],
      count: (services ?? []).length,
      search: { lat, lng, radius_km: radius, type, emergency_only: emergency },
    });
  } catch (err) {
    console.error("[help/nearby]", err);
    return NextResponse.json({ error: "Failed to fetch nearby services" }, { status: 500 });
  }
}
