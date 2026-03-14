// src/app/api/cases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, location } = body;

    if (!title || !description || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const caseId = uuidv4();

    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        id: caseId,
        user_id: user.id,
        title,
        description,
        category,
        location: location ?? null,
        status: "open",
        evidence_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*, timeline_events(*)")
      .single();

    if (caseError) throw caseError;

    // Trigger n8n: case created → AI summary → report preparation
    fetch(process.env.N8N_WEBHOOK_CASE_CREATED!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        case_id: caseId,
        user_id: user.id,
        category,
        description,
      }),
    }).catch(() => null);

    return NextResponse.json({ success: true, case: newCase }, { status: 201 });
  } catch (error) {
    console.error("[Cases POST Error]", error);
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const page = parseInt(searchParams.get("page") ?? "1");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("cases")
      .select("*, timeline_events(*)", { count: "exact" })
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: cases, error: queryError, count } = await query;
    if (queryError) throw queryError;

    return NextResponse.json({
      data: cases ?? [],
      count: count ?? 0,
      page,
      per_page: limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error("[Cases GET Error]", error);
    return NextResponse.json({ error: "Failed to fetch cases" }, { status: 500 });
  }
}
