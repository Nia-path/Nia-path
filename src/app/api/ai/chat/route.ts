// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CaseCategory, ChatAction } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the user and get real data
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user profile to personalize Nia's context
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, language_preference, county")
      .eq("id", user.id)
      .single();

    const { message, history = [], case_id, conversation_id } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    // 2. Build the System Prompt with REAL User Data
    const SYSTEM_PROMPT = `You are Nia, a compassionate, stealthy legal and safety AI advisor for women in Kenya.
You are speaking to ${profile?.display_name || "a user"}. 
They prefer to speak in ${profile?.language_preference === 'sw' ? 'Swahili' : 'English'}.
They are located in ${profile?.county || "Kenya"}.

Your role:
1. Empathize and identify the legal issue under Kenyan law.
2. Provide practical safety guidance and next steps.

RESPONSE FORMAT (Valid JSON only):
{
  "content": "Your response...",
  "case_category": "domestic_violence|sexual_harassment|property_rights|other",
  "risk_assessment": {
    "level": "low|medium|high|critical",
    "immediate_danger": true|false,
    "recommended_steps": ["Step 1", "Step 2"]
  },
  "actions": [
    { "id": "btn_1", "label": "Upload Evidence", "action": "upload_evidence", "variant": "primary" }
  ]
}

CRITICAL: If they are in immediate danger, set "immediate_danger": true, "level": "critical", and include a "call_emergency" action.`;

    // 3. Initialize Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    // 4. Format history for Gemini (translate 'assistant' to 'model')
    const formattedHistory = history.slice(-10).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // FIX: Gemini strictly requires the history array to start with a 'user' message.
    while (formattedHistory.length > 0 && formattedHistory[0].role === "model") {
      formattedHistory.shift();
    }

    // 5. Send message to Gemini
    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage([{ text: message }]);
    const raw = result.response.text() || "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        content: "I'm sorry, I had trouble processing that. Could you describe your situation again?",
        risk_assessment: { level: "low", immediate_danger: false, recommended_steps: [] },
        actions: [],
      };
    }

    // 6. Safety override — Ensure the emergency button exists if danger is detected
    if (parsed.risk_assessment?.immediate_danger || parsed.risk_assessment?.level === 'critical') {
      if (!parsed.actions?.some((a: any) => a.action === "call_emergency")) {
        parsed.actions.unshift({
          id: "emergency-override", label: "Call 999 Now", action: "call_emergency", variant: "danger", icon: "phone",
        });
      }

      // 7. Trigger n8n Orchestrator Edge Function with service role authentication
      console.log("🚀 Escalating high-risk case to n8n workflow...");
      console.log("📋 Debug - SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log("📋 Debug - SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

      try {
        const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/n8n-orchestrator`;
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            event: "ai_risk_escalation",
            user_id: user.id,
            timestamp: new Date().toISOString(),
            data: {
              session_id: "session_" + Date.now(),
              user_id: user.id,
              message_id: "msg_" + Date.now(), 
              conversation_id: conversation_id || "conv_" + Date.now(),
              case_id: case_id || null,
              risk_level: parsed.risk_assessment.level,
              immediate_danger: parsed.risk_assessment.immediate_danger,
              content: parsed.content,
              recommended_steps: parsed.risk_assessment.recommended_steps
            }
          })
        });

        const text = await response.text();
        console.log(`📋 Raw Response [${response.status}]:`, text);
        
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          result = { raw: text };
        }
        
        console.log(`✅ Workflow Escalation Response [${response.status}]:`, result);
        
        if (!response.ok) {
          console.error(`❌ Edge Function auth failed. Status: ${response.status}`);
          console.error("🔍 Check that SUPABASE_SERVICE_ROLE_KEY env var is correct and deployed to Supabase");
        }
      } catch (err) {
        console.error("❌ Failed to escalate to workflow:", err);
      }
    }

    return NextResponse.json(parsed);
    
  } catch (error) {
    console.error("[AI Chat Error]", error);
    return NextResponse.json(
      {
        content: "I'm having connectivity issues. Please try again. If you're in danger, call 999 or the Gender Violence Hotline at 1195 immediately.",
        risk_assessment: { level: "low", immediate_danger: false, recommended_steps: [] },
        actions: [{ id: "emergency", label: "Call 1195", action: "call_emergency", variant: "danger" }],
      },
      { status: 200 } 
    );
  }
}