// src/components/features/EvidenceVerificationBadge.tsx
"use client";

import { cn } from "@/utils";
import type { VerificationStatus } from "@/types/extensions";
import { Shield, ShieldCheck, ShieldAlert, ShieldOff, Loader2 } from "lucide-react";
import { useEvidenceVerificationStatus } from "@/hooks/useExtendedFeatures";

interface EvidenceVerificationBadgeProps {
  evidenceId: string;
  initialStatus?: VerificationStatus;
  showDetails?: boolean;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; icon: React.ElementType; bg: string; text: string; dot: string }
> = {
  pending: {
    label: "Awaiting verification",
    icon: Loader2,
    bg: "bg-earth-100",
    text: "text-earth-600",
    dot: "bg-earth-400",
  },
  verifying: {
    label: "Verifying integrity…",
    icon: Loader2,
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  verified: {
    label: "Integrity verified",
    icon: ShieldCheck,
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  tampered: {
    label: "Tampering detected",
    icon: ShieldAlert,
    bg: "bg-emergency-50",
    text: "text-emergency-700",
    dot: "bg-emergency-500",
  },
  unverifiable: {
    label: "Cannot verify",
    icon: ShieldOff,
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
};

export function EvidenceVerificationBadge({
  evidenceId,
  initialStatus = "pending",
  showDetails = false,
}: EvidenceVerificationBadgeProps) {
  const { data } = useEvidenceVerificationStatus(evidenceId);
  const status: VerificationStatus = data?.verification_status ?? initialStatus;
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const isSpinning = status === "pending" || status === "verifying";

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      cfg.bg, cfg.text
    )}>
      <Icon className={cn("w-3 h-3 shrink-0", isSpinning && "animate-spin")} />
      <span>{cfg.label}</span>

      {showDetails && data?.checksum_verified && (
        <span className="text-[10px] opacity-60 ml-1">
          {data.checksum_sha256?.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}

// ── Evidence card with full metadata ─────────────────────────────────────────

interface EvidenceCardExtendedProps {
  evidence: {
    id: string;
    type: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    captured_at: string;
    verification_status?: VerificationStatus;
    device_platform?: string;
    checksum_sha256?: string;
    submitted_to_police?: boolean;
    submitted_to_court?: boolean;
  };
  onClick?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  photo: "🖼️",
  video: "🎥",
  audio: "🎙️",
  document: "📄",
  screenshot: "📸",
  location: "📍",
  property_doc: "📋",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceCardExtended({ evidence, onClick }: EvidenceCardExtendedProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-earth-100 p-3 space-y-2.5",
        "shadow-nia-card transition-all duration-200",
        onClick && "hover:shadow-nia-card-hover cursor-pointer active:scale-[0.98]"
      )}
    >
      {/* Thumbnail area */}
      <div className="h-24 bg-earth-50 rounded-xl flex items-center justify-center relative overflow-hidden">
        <span className="text-3xl">{TYPE_ICONS[evidence.type] ?? "📎"}</span>
        {evidence.device_platform && (
          <span className={cn(
            "absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
            "bg-earth-100 text-earth-600"
          )}>
            {evidence.device_platform}
          </span>
        )}
      </div>

      {/* File info */}
      <div>
        <p className="text-xs font-medium text-earth-800 truncate leading-tight">
          {evidence.file_name}
        </p>
        <p className="text-[10px] text-earth-400 mt-0.5">
          {formatSize(evidence.file_size)}
        </p>
      </div>

      {/* Verification badge */}
      <EvidenceVerificationBadge
        evidenceId={evidence.id}
        initialStatus={evidence.verification_status ?? "pending"}
      />

      {/* Legal submission flags */}
      {(evidence.submitted_to_police || evidence.submitted_to_court) && (
        <div className="flex flex-wrap gap-1">
          {evidence.submitted_to_police && (
            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
              Police
            </span>
          )}
          {evidence.submitted_to_court && (
            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
              Court
            </span>
          )}
        </div>
      )}
    </div>
  );
}
