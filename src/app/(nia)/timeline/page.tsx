// src/app/(nia)/timeline/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useCase, useCases } from "@/hooks/useCases";
import { useEvidence } from "@/hooks/useEvidence";
import { Card, Badge, Skeleton } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, formatDate, CASE_CATEGORY_LABELS, CASE_CATEGORY_COLORS, EVIDENCE_TYPE_ICONS } from "@/utils";
import type { TimelineEvent } from "@/types";
import {
  Clock,
  FileText,
  Bot,
  FolderLock,
  Phone,
  User,
  Download,
  ChevronDown,
  CheckCircle,
} from "lucide-react";

const EVENT_ICONS: Record<TimelineEvent["event_type"], React.ElementType> = {
  evidence_added:   FolderLock,
  ai_analysis:      Bot,
  report_generated: FileText,
  contact_made:     Phone,
  manual:           User,
};

const EVENT_COLORS: Record<TimelineEvent["event_type"], string> = {
  evidence_added:   "bg-blue-100 text-blue-600",
  ai_analysis:      "bg-nia-100 text-nia-600",
  report_generated: "bg-green-100 text-green-600",
  contact_made:     "bg-purple-100 text-purple-600",
  manual:           "bg-earth-100 text-earth-600",
};

export default function TimelinePage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("case") ?? "";
  const { data: allCases } = useCases();
  const { data: activeCase, isLoading: caseLoading } = useCase(caseId);
  const { data: evidence } = useEvidence(caseId);

  const displayCase = activeCase ?? allCases?.[0];

  const handleGenerateReport = async () => {
    if (!displayCase) return;
    await fetch("/api/cases/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: displayCase.id }),
    });
  };

  if (caseLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (!displayCase) {
    return (
      <Card className="text-center py-12">
        <Clock className="w-10 h-10 text-earth-200 mx-auto mb-3" />
        <p className="text-earth-500 text-sm">No case selected</p>
        <p className="text-earth-400 text-xs mt-1">Start a case in the AI chat to build your timeline</p>
      </Card>
    );
  }

  const allEvents = [
    ...displayCase.timeline_events,
    // Synthesise evidence events
    ...(evidence?.map((e) => ({
      id: `ev-${e.id}`,
      case_id: e.case_id,
      title: `Evidence added: ${e.file_name}`,
      description: e.description ?? `${e.type} captured`,
      event_date: e.captured_at,
      event_type: "evidence_added" as const,
    })) ?? []),
  ].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Case header */}
      <Card className="bg-nia-gradient text-white !shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Badge className={cn(CASE_CATEGORY_COLORS[displayCase.category], "!text-xs mb-2")}>
              {CASE_CATEGORY_LABELS[displayCase.category]}
            </Badge>
            <h1 className="font-heading text-xl text-white truncate">{displayCase.title}</h1>
            <p className="text-white/70 text-xs mt-1">
              Opened {formatDate(displayCase.created_at)} · {displayCase.evidence_count} evidence files
            </p>
          </div>
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white capitalize"
          )}>
            {displayCase.status.replace("_", " ")}
          </div>
        </div>

        {displayCase.ai_summary && (
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs text-white/70 font-medium">AI Summary</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{displayCase.ai_summary}</p>
          </div>
        )}
      </Card>

      {/* Risk level */}
      {displayCase.ai_risk_level && (
        <div className={cn(
          "flex items-center gap-3 rounded-2xl p-4 border",
          displayCase.ai_risk_level === "critical" && "bg-emergency-50 border-emergency-200",
          displayCase.ai_risk_level === "high" && "bg-orange-50 border-orange-200",
          displayCase.ai_risk_level === "medium" && "bg-yellow-50 border-yellow-200",
          displayCase.ai_risk_level === "low" && "bg-green-50 border-green-200",
        )}>
          <CheckCircle className={cn(
            "w-5 h-5 shrink-0",
            displayCase.ai_risk_level === "critical" && "text-emergency-500",
            displayCase.ai_risk_level === "high" && "text-orange-500",
            displayCase.ai_risk_level === "medium" && "text-yellow-500",
            displayCase.ai_risk_level === "low" && "text-green-500",
          )} />
          <div>
            <p className="text-sm font-semibold text-earth-800 capitalize">
              {displayCase.ai_risk_level} risk level
            </p>
            <p className="text-xs text-earth-500">
              Based on AI analysis of your situation
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={handleGenerateReport}
        >
          <FileText className="w-4 h-4" /> Generate Report
        </Button>
        <Button variant="secondary" size="sm" className="flex-1 gap-1.5">
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-sm font-semibold text-earth-600 uppercase tracking-wide mb-4">
          Case Timeline
        </h2>

        {allEvents.length === 0 ? (
          <Card className="text-center py-8">
            <Clock className="w-8 h-8 text-earth-200 mx-auto mb-2" />
            <p className="text-sm text-earth-400">No events yet</p>
          </Card>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-4 bottom-4 w-px bg-earth-100" />

            <div className="space-y-4">
              {allEvents.map((event, i) => {
                const Icon = EVENT_ICONS[event.event_type];
                const colorClass = EVENT_COLORS[event.event_type];

                return (
                  <div key={event.id} className="flex gap-4">
                    {/* Icon dot */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10",
                      colorClass
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {/* Content */}
                    <Card className="flex-1 !py-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                      <p className="text-sm font-medium text-earth-800">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-earth-500 mt-0.5 leading-relaxed">
                          {event.description}
                        </p>
                      )}
                      <p className="text-xs text-earth-300 mt-1.5">
                        {formatDate(event.event_date, "MMM d, yyyy · h:mm a")}
                      </p>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
