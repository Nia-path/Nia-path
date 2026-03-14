// src/components/features/RiskBanner.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils";
import type { RiskLevel, RiskCategory } from "@/types/extensions";
import {
  AlertTriangle,
  ShieldAlert,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

interface RiskBannerProps {
  level: RiskLevel;
  category: RiskCategory;
  immediiateDanger: boolean;
  steps: string[];
  onDismiss: () => void;
  onGetHelp: () => void;
}

const RISK_CONFIG = {
  low: {
    bg: "bg-green-50 border-green-200",
    icon: ShieldAlert,
    iconColor: "text-green-600",
    title: "Low Risk",
    titleColor: "text-green-800",
    badgeBg: "bg-green-100 text-green-700",
  },
  medium: {
    bg: "bg-yellow-50 border-yellow-200",
    icon: AlertTriangle,
    iconColor: "text-yellow-600",
    title: "Caution — Moderate Risk",
    titleColor: "text-yellow-800",
    badgeBg: "bg-yellow-100 text-yellow-700",
  },
  high: {
    bg: "bg-orange-50 border-orange-300",
    icon: AlertTriangle,
    iconColor: "text-orange-600",
    title: "High Risk Detected",
    titleColor: "text-orange-900",
    badgeBg: "bg-orange-100 text-orange-800",
  },
  critical: {
    bg: "bg-emergency-50 border-emergency-400",
    icon: ShieldAlert,
    iconColor: "text-emergency-600",
    title: "Critical — Immediate Danger",
    titleColor: "text-emergency-900",
    badgeBg: "bg-emergency-100 text-emergency-700",
  },
} as const;

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  domestic_violence: "Domestic Violence",
  sexual_violence: "Sexual Violence",
  stalking: "Stalking / Harassment",
  financial_coercion: "Financial Coercion",
  child_at_risk: "Child at Risk",
  suicidal_ideation: "Mental Health Crisis",
  property_threat: "Property Threat",
  workplace_threat: "Workplace Threat",
  general_distress: "General Distress",
  none: "Situation Assessed",
};

export function RiskBanner({
  level,
  category,
  immediiateDanger,
  steps,
  onDismiss,
  onGetHelp,
}: RiskBannerProps) {
  const [expanded, setExpanded] = useState(
    level === "high" || level === "critical"
  );

  if (level === "low" && !immediiateDanger) return null;

  const cfg = RISK_CONFIG[level];
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "rounded-2xl border overflow-hidden",
          cfg.bg,
          level === "critical" && "animate-pulse-slow ring-2 ring-emergency-400/40"
        )}
      >
        {/* Header row */}
        <div className="flex items-start gap-3 p-4">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
            "bg-white/60"
          )}>
            <Icon className={cn("w-4 h-4", cfg.iconColor)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("text-sm font-semibold", cfg.titleColor)}>
                {cfg.title}
              </p>
              {category !== "none" && (
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  cfg.badgeBg
                )}>
                  {CATEGORY_LABELS[category]}
                </span>
              )}
            </div>

            {immediiateDanger && (
              <p className="text-xs text-emergency-700 font-medium mt-0.5">
                Your safety may be at immediate risk. Please call 999.
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {steps.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                aria-label={expanded ? "Collapse" : "Expand guidance"}
              >
                {expanded
                  ? <ChevronUp className="w-4 h-4 text-earth-500" />
                  : <ChevronDown className="w-4 h-4 text-earth-500" />
                }
              </button>
            )}
            {level !== "critical" && (
              <button
                onClick={onDismiss}
                className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-earth-400" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded steps */}
        <AnimatePresence>
          {expanded && steps.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">
                <div className="bg-white/60 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-earth-600 uppercase tracking-wide">
                    Recommended Steps
                  </p>
                  <ol className="space-y-1.5">
                    {steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-earth-700">
                        <span className={cn(
                          "w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5",
                          cfg.badgeBg
                        )}>
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onGetHelp}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5",
                      "py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95",
                      level === "critical"
                        ? "bg-emergency-600 text-white hover:bg-emergency-700"
                        : "bg-nia-600 text-white hover:bg-nia-700"
                    )}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Find Help Nearby
                  </button>
                  <a
                    href="tel:999"
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-4",
                      "py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95",
                      "bg-white/70 text-emergency-700 hover:bg-white/90 border border-emergency-200"
                    )}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    999
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
