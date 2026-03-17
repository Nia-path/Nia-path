// src/app/auth/layout.tsx
// Shared layout for all /auth/* pages.
// Renders the NiaPath visual identity alongside the auth forms.
// Mobile-first, following the deep earth + warm gold palette.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nia Path — Sign In",
  description: "Secure access to your Nia Path account",
  robots: { index: false, follow: false }, // Auth pages should not be indexed
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-earth-900 flex flex-col">
      {/* Ambient background pattern */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(196,127,34,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(122,74,22,0.15) 0%, transparent 60%)
          `,
        }}
      />

      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-4 py-12 safe-top safe-bottom">
        {/* Logo mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-nia-gradient flex items-center justify-center shadow-glow">
            <span className="text-white font-heading text-2xl font-bold select-none">N</span>
          </div>
          <div className="text-center">
            <h1 className="font-heading text-2xl text-white font-semibold tracking-wide">
              Nia Path
            </h1>
            <p className="text-earth-400 text-xs mt-0.5 tracking-widest uppercase">
              Justice &amp; Protection
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm">
          <div className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-3xl p-7 shadow-2xl">
            {children}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-earth-500 max-w-xs leading-relaxed">
          Your privacy is protected. All data is encrypted and only
          accessible by you.
        </p>
      </div>
    </div>
  );
}
