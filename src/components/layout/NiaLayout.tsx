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
  ShieldAlert
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
    <div className="flex min-h-screen bg-nia-50 bg-earth-texture">
      {/* 🔴 Global Emergency Banner */}
      {isEmergencyActive && (
        <div className="fixed top-0 inset-x-0 z-50 bg-emergency-600 text-white px-4 py-2 flex items-center justify-between animate-fade-in md:ml-64">
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

      {/* 💻 DESKTOP SIDEBAR (Hidden on mobile) */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-40 bg-white/90 backdrop-blur-md border-r border-earth-100">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-nia-gradient flex items-center justify-center">
            <span className="text-white text-sm font-bold">N</span>
          </div>
          <span className="font-heading text-earth-900 font-semibold text-xl">Nia Path</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  isActive
                    ? "bg-nia-50 text-nia-700"
                    : "text-earth-500 hover:bg-earth-50 hover:text-earth-900"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "text-nia-600")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-earth-100">
          <button
            onClick={isEmergencyActive ? stopEmergency : startEmergency}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all",
              isEmergencyActive
                ? "bg-emergency-600 text-white animate-pulse-slow"
                : "bg-emergency-50 text-emergency-700 hover:bg-emergency-100 border border-emergency-200"
            )}
          >
            <ShieldAlert className="w-5 h-5" />
            {isEmergencyActive ? "Recording..." : "Trigger SOS"}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper (Shifts right on desktop to make room for sidebar) */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64 relative">
        
        {/* 📱 MOBILE HEADER (Hidden on desktop) */}
        <header className={cn(
          "md:hidden fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-md border-b border-earth-100",
          isEmergencyActive && "top-10"
        )}>
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-nia-gradient flex items-center justify-center">
                <span className="text-white text-xs font-bold">N</span>
              </div>
              <span className="font-heading text-earth-900 font-semibold text-lg">Nia Path</span>
            </div>
            <button
              onClick={isEmergencyActive ? stopEmergency : startEmergency}
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

        {/* 📄 MAIN CONTENT */}
        {/* On mobile: narrow max-w-md and extra padding for mobile nav/header */}
        {/* On desktop: full width with responsive padding, no max-width constraint */}
        <main className={cn(
          "flex-1 w-full mx-auto px-4",
          "pt-20 pb-24 max-w-md", // Mobile spacing
          "md:pt-8 md:pb-8 md:px-6 md:max-w-none", // Desktop: full width, no constraint
          "lg:px-8 xl:px-12", // Larger screens: more padding
          isEmergencyActive && "pt-30 md:pt-16"
        )}>
          {children}
        </main>

        {/* 📱 MOBILE BOTTOM NAV (Hidden on desktop) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-earth-100">
          <div className="px-2 h-16 flex items-center justify-around">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
                    isActive ? "text-nia-600" : "text-earth-400 hover:text-earth-600"
                  )}
                >
                  <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                  {isActive && <span className="w-1 h-1 rounded-full bg-nia-500 mt-0.5" />}
                </Link>
              );
            })}
          </div>
        </nav>

      </div>
    </div>
  );
}