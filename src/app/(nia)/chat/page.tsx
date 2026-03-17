// src/app/(nia)/chat/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppDispatch, useCurrentUser } from "@/store/hooks";
import { setActiveCase } from "@/store/slices/casesSlice";
import { useCreateCase } from "@/hooks/useCases";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, CASE_CATEGORY_LABELS } from "@/utils";
import { saveChatMessage, getChatHistory } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, ChatAction, CaseCategory } from "@/types";
import {
  Send,
  Bot,
  User,
  Mic,
  FolderLock,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

const ACTION_ICONS: Record<string, React.ElementType> = {
  create_case: FolderLock,
  call_emergency: Phone,
  find_shelter: MapPin,
  upload_evidence: FolderLock,
  generate_report: FileText,
};

const SUGGESTED_PROMPTS = [
  "My husband beats me and threatens me",
  "My employer is sexually harassing me",
  "My in-laws are grabbing my land after my husband died",
  "I need to know my rights as a wife",
  "How can I safely leave an abusive relationship?",
];

export default function ChatPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useCurrentUser();
  const createCase = useCreateCase();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load offline chat history
  useEffect(() => {
    getChatHistory(sessionId).then((history) => {
      if (history.length > 0) {
        setMessages(
          history.map((h) => ({
            id: h.id,
            role: h.role,
            content: h.content,
            timestamp: h.timestamp,
          }))
        );
      } else {
        // Welcome message
        setMessages([
          {
            id: uuidv4(),
            role: "assistant",
            content:
              "Habari! I'm your Nia Path AI advisor. I'm here to listen and help you understand your rights and options. Everything you share with me is confidential.\n\nYou can describe your situation in your own words — in English or Swahili. How can I help you today?",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = text ?? input.trim();
      if (!content || isLoading) return;

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      // Save to offline store
      await saveChatMessage({ ...userMsg, session_id: sessionId });

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        
        // UPDATED: Now passing conversation_id so the backend can trigger n8n workflows
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: content, 
            history,
            conversation_id: sessionId 
          }),
        });

        if (!res.ok) throw new Error("API error");
        const data = await res.json();

        const aiMsg: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: data.content,
          timestamp: new Date().toISOString(),
          actions: data.actions,
          case_category: data.case_category,
          risk_assessment: data.risk_assessment,
        };

        setMessages((prev) => [...prev, aiMsg]);
        await saveChatMessage({ ...aiMsg, session_id: sessionId });
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content:
              "I'm having trouble connecting right now. Your message has been saved. Please try again when your connection improves — your safety is our priority.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading, messages, sessionId]
  );

  const handleAction = useCallback(
    async (action: ChatAction, category?: CaseCategory) => {
      switch (action.action) {
        case "create_case": {
          const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
          const newCase = await createCase.mutateAsync({
            title: `Case – ${category ? CASE_CATEGORY_LABELS[category] : "Reported Incident"}`,
            description: lastUserMsg?.content ?? "",
            category: category ?? "other",
            location: undefined,
          });
          dispatch(setActiveCase(newCase));
          router.push(`/evidence?case=${newCase.id}`);
          break;
        }
        case "call_emergency":
          window.open("tel:999");
          break;
        case "find_shelter":
          router.push("/help");
          break;
        case "upload_evidence":
          router.push("/evidence");
          break;
        case "generate_report":
          router.push("/timeline");
          break;
      }
    },
    [messages, createCase, dispatch, router]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-nia-gradient flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-heading text-lg text-earth-900">Nia AI Advisor</h1>
          <p className="text-xs text-earth-400">Confidential · Available 24/7</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-xs text-earth-400">Secure</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-2">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar */}
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              msg.role === "user" ? "bg-nia-100" : "bg-nia-gradient"
            )}>
              {msg.role === "user"
                ? <User className="w-4 h-4 text-nia-700" />
                : <Bot className="w-4 h-4 text-white" />
              }
            </div>

            <div className={cn("flex flex-col gap-2 max-w-[82%]", msg.role === "user" && "items-end")}>
              {/* Bubble */}
              <div className={msg.role === "user" ? "chat-user" : "chat-ai"}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Risk assessment */}
              {msg.risk_assessment && msg.risk_assessment.level !== "low" && (
                <Card className={cn(
                  "border-l-4 !py-3",
                  msg.risk_assessment.level === "critical" && "border-l-emergency-500 bg-emergency-50",
                  msg.risk_assessment.level === "high" && "border-l-orange-500 bg-orange-50",
                  msg.risk_assessment.level === "medium" && "border-l-yellow-500 bg-yellow-50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-emergency-600 shrink-0" />
                    <p className="text-xs font-semibold text-emergency-800 uppercase tracking-wide">
                      {msg.risk_assessment.immediate_danger ? "Immediate danger detected" : `${msg.risk_assessment.level} risk`}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {msg.risk_assessment.recommended_steps.map((step, i) => (
                      <li key={i} className="text-xs text-earth-700 flex gap-1.5">
                        <span className="text-nia-500 shrink-0">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.actions.map((action) => {
                    const Icon = ACTION_ICONS[action.action];
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleAction(action, msg.case_category)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium",
                          "transition-all active:scale-95",
                          action.variant === "primary" && "bg-nia-600 text-white hover:bg-nia-700",
                          action.variant === "secondary" && "bg-earth-100 text-earth-700 hover:bg-earth-200",
                          action.variant === "danger" && "bg-emergency-600 text-white hover:bg-emergency-700"
                        )}
                      >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-nia-gradient flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="chat-ai flex items-center gap-1">
              {[0,1,2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-earth-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts — only when few messages */}
      {messages.length <= 2 && (
        <div className="py-3 flex flex-col gap-2">
          <p className="text-xs text-earth-400 text-center">Common situations</p>
          <div className="flex flex-col gap-1.5">
            {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-left text-xs text-earth-600 bg-earth-50 hover:bg-earth-100 border border-earth-100 rounded-xl px-3 py-2 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-earth-200 px-3 py-2 shadow-sm">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Describe your situation…"
          className="flex-1 bg-transparent text-sm text-earth-900 placeholder:text-earth-400 outline-none"
          disabled={isLoading}
          aria-label="Message"
        />
        <button
          aria-label="Voice input"
          className="w-8 h-8 flex items-center justify-center text-earth-400 hover:text-nia-600 transition-colors"
        >
          <Mic className="w-4 h-4" />
        </button>
        <Button
          size="sm"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          className="!h-8 !px-3 !rounded-xl"
          aria-label="Send"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}