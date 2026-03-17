// src/components/auth/AuthProvider.tsx
// Bridges Supabase Auth real-time session changes into the Redux store.
// Wrap the entire app with this so the store is always in sync with Supabase.
// Renders nothing — pure side-effect component.

"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks";
import { createClient } from "@/lib/supabase/client";
import {
  initializeAuth,
  setSessionFromListener,
  fetchProfile,
} from "@/store/slices/authSlice";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    // 1. Hydrate from existing session on mount
    dispatch(initializeAuth());

    // 2. Subscribe to all future auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      dispatch(
        setSessionFromListener({
          session,
          user: session?.user ?? null,
        })
      );

      if (event === "SIGNED_IN" && session?.user) {
        // Refresh profile on every sign-in
        dispatch(fetchProfile(session.user.id));
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        // Keep profile in sync after token refresh
        dispatch(fetchProfile(session.user.id));
      }

      if (event === "USER_UPDATED" && session?.user) {
        dispatch(fetchProfile(session.user.id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
}
