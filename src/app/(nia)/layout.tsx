// src/app/(nia)/layout.tsx
// Protected layout for all Nia platform pages (/dashboard, /chat, etc.)
// Three-layer protection:
//   1. Middleware redirects unauthenticated requests before the page renders
//   2. This layout double-checks auth in the client (defense in depth)
//   3. AuthInitializer manages Nia PIN session expiry
//
// REPLACE the existing src/app/(nia)/layout.tsx with this file.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated, useIsInitializing, useIsNiaUnlocked } from "@/store/hooks";
import { NiaLayout } from "@/components/layout/NiaLayout";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { AuthInitializer } from "@/components/auth/AuthInitializer";

export default function NiaRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isInitializing = useIsInitializing();
  const isAuthenticated = useIsAuthenticated();
  const isNiaUnlocked = useIsNiaUnlocked();

  // Client-side guard (middleware already handles the server-side redirect)
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace("/auth/sign-in");
    }
  }, [isInitializing, isAuthenticated, router]);

  // Nia PIN gate — redirect to the stealth home page if PIN not entered
  // The stealth page (/) has the PIN pad; user must unlock before seeing Nia
  useEffect(() => {
    if (!isInitializing && isAuthenticated && !isNiaUnlocked) {
      // We replace() rather than push() so the user can't press back to bypass
      router.replace("/");
    }
  }, [isInitializing, isAuthenticated, isNiaUnlocked, router]);

  // Show loading screen while checking session or PIN
  if (isInitializing || !isAuthenticated || !isNiaUnlocked) {
    return <AuthLoadingScreen />;
  }

  return (
    <>
      {/* AuthInitializer handles PIN expiry checks and profile refreshes */}
      <AuthInitializer />
      <NiaLayout>{children}</NiaLayout>
    </>
  );
}
