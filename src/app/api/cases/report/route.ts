// src/app/api/cases/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { case_id } = await req.json();

    // Fetch case with evidence
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("*, timeline_events(*)")
      .eq("id", case_id)
      .eq("user_id", user.id)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const { data: evidence } = await supabase
      .from("evidence")
      .select("*")
      .eq("case_id", case_id)
      .order("captured_at");

    // Generate AI report summary
    const reportPrompt = `You are a legal documentation assistant for women's rights cases in Kenya.
    
Generate a professional case report summary for the following case:

Case Title: ${caseData.title}
Category: ${caseData.category}
Description: ${caseData.description}
Status: ${caseData.status}
Date Opened: ${caseData.created_at}
Evidence Count: ${evidence?.length ?? 0}

Evidence items:
${evidence?.map((e) => `- ${e.type}: ${e.file_name} (${e.captured_at})`).join("\n") ?? "None"}

Timeline Events:
${caseData.timeline_events?.map((t: { event_date: string; title: string; description: string }) =>
  `- ${t.event_date}: ${t.title} — ${t.description}`).join("\n") ?? "None"}

Generate a structured report including:
1. Executive Summary
2. Incident Description
3. Evidence Summary  
4. Recommended Legal Actions under Kenyan Law
5. Suggested Support Services

Keep the language clear and formal, suitable for submission to authorities.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: reportPrompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const reportContent = completion.choices[0]?.message?.content ?? "";

    // Save report as timeline event
    await supabase.from("timeline_events").insert({
      case_id,
      title: "Legal Report Generated",
      description: "AI-assisted report prepared for legal proceedings",
      event_date: new Date().toISOString(),
      event_type: "report_generated",
    });

    // Update case with AI summary
    await supabase
      .from("cases")
      .update({
        ai_summary: reportContent.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", case_id);

    // Trigger n8n for PDF generation and storage
    fetch(process.env.N8N_WEBHOOK_REPORT_GENERATED!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id, user_id: user.id, report_content: reportContent }),
    }).catch(() => null);

    return NextResponse.json({ success: true, report: reportContent });
  } catch (error) {
    console.error("[Report Generation Error]", error);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
