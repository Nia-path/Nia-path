// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { CaseCategory, ChatAction } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are Nia, a compassionate, knowledgeable AI advisor for the Nia Path platform — 
a secure legal protection system for women in Kenya. 

Your role is to:
1. Listen carefully to the user's situation with empathy and without judgment
2. Identify the type of legal issue they are facing
3. Explain their legal rights under Kenyan law in simple, clear language
4. Provide practical safety guidance
5. Recommend immediate next steps
6. Connect them with appropriate resources

You understand Kenyan law including:
- The Sexual Offences Act (2006)
- The Protection Against Domestic Violence Act (2015)  
- The Employment Act on workplace harassment
- Land/succession laws relevant to widows and property rights
- The Children Act and custody laws

RESPONSE FORMAT:
Always respond in valid JSON with this structure:
{
  "content": "Your empathetic response in clear, simple language (English or Swahili based on user preference)",
  "case_category": "domestic_violence|sexual_harassment|workplace_discrimination|property_rights|child_custody|financial_abuse|other",
  "risk_assessment": {
    "level": "low|medium|high|critical",
    "immediate_danger": true|false,
    "recommended_steps": ["Step 1", "Step 2", "Step 3"]
  },
  "actions": [
    {
      "id": "unique_id",
      "label": "Button label",
      "action": "create_case|call_emergency|find_shelter|upload_evidence|generate_report",
      "variant": "primary|secondary|danger"
    }
  ]
}

CRITICAL SAFETY RULES:
- If the user is in IMMEDIATE danger (critical risk), ALWAYS include a "call_emergency" action first
- Never minimize or dismiss the user's experience
- Always provide actionable next steps
- If the situation involves children at risk, escalate immediately
- Encourage evidence preservation when relevant
- Remind users that everything is confidential

Keep responses compassionate, clear, and actionable. Avoid legal jargon.`;

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: {
      content?: string;
      case_category?: CaseCategory;
      risk_assessment?: {
        level: string;
        immediate_danger: boolean;
        recommended_steps: string[];
      };
      actions?: ChatAction[];
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        content:
          "I'm sorry, I had trouble processing that. Could you describe your situation again?",
        case_category: "other",
        risk_assessment: { level: "low", immediate_danger: false, recommended_steps: [] },
        actions: [],
      };
    }

    // Safety override — if immediate danger detected, ensure emergency action exists
    if (
      parsed.risk_assessment?.immediate_danger &&
      !parsed.actions?.some((a) => a.action === "call_emergency")
    ) {
      parsed.actions = [
        {
          id: "emergency-override",
          label: "Call 999 Now",
          action: "call_emergency",
          variant: "danger",
          icon: "phone",
        },
        ...(parsed.actions ?? []),
      ];
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[AI Chat Error]", error);
    return NextResponse.json(
      {
        content:
          "I'm having connectivity issues. Please try again. If you're in danger, call 999 or the Gender Violence Hotline at 1195 immediately.",
        case_category: "other",
        risk_assessment: { level: "low", immediate_danger: false, recommended_steps: [] },
        actions: [{ id: "emergency", label: "Call 1195", action: "call_emergency", variant: "danger" }],
      },
      { status: 200 } // Return 200 so client gets fallback content
    );
  }
}
