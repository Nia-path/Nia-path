// src/app/(nia)/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useCases } from "@/hooks/useCases";
import { useCurrentUser, useCurrentProfile } from "@/store/hooks";
import { Card, Skeleton, Badge } from "@/components/ui/Card";
import { CASE_CATEGORY_LABELS, CASE_CATEGORY_COLORS, formatRelativeTime } from "@/utils";
import {
  MessageSquare,
  FolderLock,
  MapPin,
  Clock,
  Siren,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Lock,
} from "lucide-react";

const quickActions = [
  { label: "Talk to Advisor",  icon: MessageSquare, href: "/chat",     color: "bg-nia-100 text-nia-700" },
  { label: "Add Evidence",     icon: FolderLock,    href: "/evidence", color: "bg-earth-100 text-earth-700" },
  { label: "Find Help",        icon: MapPin,         href: "/help",     color: "bg-blue-100 text-blue-700" },
  { label: "Timeline",         icon: Clock,          href: "/timeline", color: "bg-purple-100 text-purple-700" },
];

export default function DashboardPage() {
  const user = useCurrentUser();
  const profile = useCurrentProfile();
  const { data: cases, isLoading } = useCases();

  const activeCases = cases?.filter((c) => c.status !== "closed" && c.status !== "archived") ?? [];
  const criticalCases = cases?.filter((c) => c.ai_risk_level === "critical") ?? [];
  const hasPinSetup = !!profile?.pin_hash;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="pt-2">
        <p className="text-earth-500 text-sm">Welcome back,</p>
        <h1 className="font-heading text-2xl text-earth-900 mt-0.5">
          {profile?.full_name?.split(" ")[0] ?? "Nia Sister"}
        </h1>
        <div className="flex items-center gap-1.5 mt-2">
          <ShieldCheck className="w-4 h-4 text-nia-500" />
          <span className="text-xs text-nia-600 font-medium">Your data is secure and encrypted</span>
        </div>
      </div>

      {/* PIN setup banner for new users */}
      {!hasPinSetup && (
        <Link href="/profile">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 hover:border-amber-300 transition-colors cursor-pointer">
            <div className="flex-shrink-0 pt-0.5">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">Set up your security PIN</h3>
              <p className="text-xs text-amber-700 mt-1">
                Protect your sensitive data with a 6-digit PIN. Go to your profile to complete setup.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          </div>
        </Link>
      )}

      {/* Critical alert */}
      {criticalCases.length > 0 && (
        <div className="bg-emergency-50 border border-emergency-200 rounded-2xl p-4 flex items-start gap-3">
          <Siren className="w-5 h-5 text-emergency-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emergency-800">
              {criticalCases.length} case{criticalCases.length > 1 ? "s" : ""} need immediate attention
            </p>
            <p className="text-xs text-emergency-600 mt-0.5">
              Please speak to a legal advisor or contact emergency services.
            </p>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-earth-600 mb-3 uppercase tracking-wide">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ label, icon: Icon, href, color }) => (
            <Link key={href} href={href}>
              <Card hover className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-earth-800 leading-tight">{label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* My Cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-earth-600 uppercase tracking-wide">
            My Cases
          </h2>
          <Link href="/chat" className="flex items-center gap-1 text-xs text-nia-600 font-medium">
            <PlusCircle className="w-3.5 h-3.5" />
            New case
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : activeCases.length === 0 ? (
          <Card className="text-center py-8">
            <FolderLock className="w-10 h-10 text-earth-300 mx-auto mb-3" />
            <p className="text-earth-600 text-sm font-medium">No active cases</p>
            <p className="text-earth-400 text-xs mt-1">
              Chat with our AI advisor to get started
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1 mt-4 text-sm text-nia-600 font-medium"
            >
              Start a conversation <ChevronRight className="w-4 h-4" />
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeCases.map((c) => (
              <Link key={c.id} href={`/timeline?case=${c.id}`}>
                <Card hover className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={CASE_CATEGORY_COLORS[c.category]}>
                        {CASE_CATEGORY_LABELS[c.category]}
                      </Badge>
                      {c.ai_risk_level === "critical" && (
                        <Badge variant="danger">Critical</Badge>
                      )}
                      {c.ai_risk_level === "high" && (
                        <Badge variant="warning">High Risk</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-earth-800 truncate">{c.title}</p>
                    <p className="text-xs text-earth-400 mt-0.5">
                      {c.evidence_count} evidence · {formatRelativeTime(c.updated_at)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-earth-300 shrink-0 mt-1" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Safety reminder */}
      <div className="bg-nia-50 rounded-2xl p-4 border border-nia-100">
        <p className="text-xs text-nia-700 leading-relaxed">
          <strong>Stay safe:</strong> Return to the home screen by pressing the back button. 
          Your data is encrypted and only accessible with your PIN.
        </p>
      </div>
    </div>
  );
}
