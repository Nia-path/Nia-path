// src/components/auth/AuthInitializer.tsx
// Handles cross-cutting auth concerns that run throughout the app lifecycle:
//   1. Checks if the Nia stealth PIN session has expired (8hr window)
//   2. Refreshes profile data when the user returns to the app
//
// Renders nothing — pure side-effect component.
// Include this once inside the (nia) layout.

"use client";

import { useEffect, useCallback } from "react";
import { useAppDispatch, useIsNiaUnlocked, useNiaSessionExpiresAt, useCurrentUser } from "@/store/hooks";
import { lockNia, fetchProfile } from "@/store/slices/authSlice";

export function AuthInitializer() {
  const dispatch = useAppDispatch();
  const isNiaUnlocked = useIsNiaUnlocked();
  const niaExpiresAt = useNiaSessionExpiresAt();
  const user = useCurrentUser();

  // Check Nia session expiry
  const checkNiaExpiry = useCallback(() => {
    if (isNiaUnlocked && niaExpiresAt) {
      if (new Date(niaExpiresAt) <= new Date()) {
        dispatch(lockNia());
      }
    }
  }, [dispatch, isNiaUnlocked, niaExpiresAt]);

  // Check on mount and every minute
  useEffect(() => {
    checkNiaExpiry();
    const interval = setInterval(checkNiaExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [checkNiaExpiry]);

  // Re-check when tab regains focus
  useEffect(() => {
    const handleFocus = () => {
      checkNiaExpiry();
      // Also refresh profile when returning to the app
      if (user?.id) {
        dispatch(fetchProfile(user.id));
      }
    };

    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkNiaExpiry, dispatch, user?.id]);

  return null;
}
