// src/components/layout/NiaLayout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils";
import { useEmergency } from "@/hooks/useEmergency";
import {
  LayoutDashboard,
  MessageSquare,
  FolderLock,
  Clock,
  MapPin,
  User,
  Siren,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/chat",      label: "Advisor",  icon: MessageSquare },
  { href: "/evidence",  label: "Evidence", icon: FolderLock },
  { href: "/timeline",  label: "Timeline", icon: Clock },
  { href: "/help",      label: "Help",     icon: MapPin },
  { href: "/profile",   label: "Profile",  icon: User },
];

export function NiaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isActive: isEmergencyActive, startEmergency, stopEmergency } = useEmergency();

  return (
    <div className="flex flex-col min-h-screen bg-nia-50 bg-earth-texture">
      {/* Emergency banner */}
      {isEmergencyActive && (
        <div className="fixed top-0 inset-x-0 z-50 bg-emergency-600 text-white px-4 py-2 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-recording" />
            <span className="text-sm font-medium">Emergency mode active — recording</span>
          </div>
          <button
            onClick={stopEmergency}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Header */}
      <header className={cn(
        "fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-md border-b border-earth-100",
        isEmergencyActive && "top-10"
      )}>
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-nia-gradient flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <span className="font-heading text-earth-900 font-semibold text-lg">Nia Path</span>
          </div>

          {/* Emergency button */}
          <button
            onClick={isEmergencyActive ? stopEmergency : startEmergency}
            aria-label={isEmergencyActive ? "Stop emergency" : "Activate emergency mode"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              isEmergencyActive
                ? "bg-emergency-600 text-white animate-pulse-slow"
                : "bg-emergency-50 text-emergency-700 hover:bg-emergency-100 border border-emergency-200"
            )}
          >
            <Siren className="w-3.5 h-3.5" />
            {isEmergencyActive ? "Recording" : "SOS"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={cn(
        "flex-1 max-w-md mx-auto w-full px-4",
        "pt-20 pb-24", // header + bottom nav clearance
        isEmergencyActive && "pt-30"
      )}>
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-earth-100">
        <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
                  isActive
                    ? "text-nia-600"
                    : "text-earth-400 hover:text-earth-600"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                <span className="text-[10px] font-medium leading-none">{label}</span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-nia-500 mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
