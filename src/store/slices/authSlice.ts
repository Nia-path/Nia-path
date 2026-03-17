// src/store/slices/authSlice.ts
// Manages the global authentication state for the Nia Path platform.
// Works alongside Supabase Auth — Redux holds the decoded user/session state
// so components can read auth without async calls.

import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hashPin, generateSalt } from "@/lib/crypto";
import { storePinHash, getPinHash } from "@/lib/db";
import type { Profile } from "@/types/database";

// ─── State shape ─────────────────────────────────────────────────────────────

export interface AuthState {
  // Supabase auth primitives
  user: User | null;
  session: Session | null;
  // Extended profile from profiles table
  profile: Profile | null;
  // Loading states
  isLoading: boolean;
  isInitializing: boolean; // true until we've checked for an existing session
  isProfileLoading: boolean;
  // Stealth PIN
  isNiaUnlocked: boolean;
  niaSessionExpiresAt: string | null;
  pinFailedAttempts: number;
  pinLockedUntil: string | null;
  // Errors
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  isInitializing: true,
  isProfileLoading: false,
  isNiaUnlocked: false,
  niaSessionExpiresAt: null,
  pinFailedAttempts: 0,
  pinLockedUntil: null,
  error: null,
};

// ─── Async thunks ─────────────────────────────────────────────────────────────

/** Initialize auth state from existing Supabase session on app mount */
export const initializeAuth = createAsyncThunk(
  "auth/initialize",
  async (_, { rejectWithValue }) => {
    const supabase = createClient();
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) return { session: null, user: null, profile: null };

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      return { session, user: session.user, profile };
    } catch (err) {
      const authErr = err as AuthError;
      return rejectWithValue(authErr.message ?? "Failed to initialize auth");
    }
  }
);

/** Sign in with email and password */
export const signInWithEmail = createAsyncThunk(
  "auth/signInWithEmail",
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue }
  ) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return rejectWithValue(error.message);

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return { session: data.session, user: data.user, profile };
  }
);

/** Sign up — creates auth user + profile row */
export const signUpWithEmail = createAsyncThunk(
  "auth/signUpWithEmail",
  async (
    {
      email,
      password,
      fullName,
      language = "en",
    }: {
      email: string;
      password: string;
      fullName: string;
      language?: "en" | "sw";
    },
    { rejectWithValue }
  ) => {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          language,
        },
        emailRedirectTo: `${
          typeof window !== "undefined" ? window.location.origin : ""
        }/api/auth/callback`,
      },
    });

    if (error) return rejectWithValue(error.message);
    if (!data.user) return rejectWithValue("Sign up failed — no user returned");

    // The profiles row is created by the database trigger (handle_new_user).
    // We fetch it here to confirm it exists.
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    return {
      session: data.session,
      user: data.user,
      profile: profile ?? null,
      emailConfirmationRequired: !data.session, // true if email confirmation is enabled
    };
  }
);

/** Sign out */
export const signOut = createAsyncThunk(
  "auth/signOut",
  async (_, { rejectWithValue }) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return rejectWithValue(error.message);
    return null;
  }
);

/** Send password reset email */
export const sendPasswordReset = createAsyncThunk(
  "auth/sendPasswordReset",
  async (email: string, { rejectWithValue }) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${
        typeof window !== "undefined" ? window.location.origin : ""
      }/auth/update-password`,
    });
    if (error) return rejectWithValue(error.message);
    return email;
  }
);

/** Update password (called from the reset link) */
export const updatePassword = createAsyncThunk(
  "auth/updatePassword",
  async (newPassword: string, { rejectWithValue }) => {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return rejectWithValue(error.message);
    return true;
  }
);

/** Fetch or refresh the user profile from the database */
export const fetchProfile = createAsyncThunk<Profile, string>(
  "auth/fetchProfile",
  async (userId: string, { rejectWithValue }) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) return rejectWithValue(error.message);
    return data as Profile;
  }
);

/** Verify the stealth PIN — pure client-side crypto */
export const verifyPin = createAsyncThunk(
  "auth/verifyPin",
  async (pin: string, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    const { pinLockedUntil } = state.auth;

    // Check lockout
    if (pinLockedUntil && new Date(pinLockedUntil) > new Date()) {
      const mins = Math.ceil(
        (new Date(pinLockedUntil).getTime() - Date.now()) / 60000
      );
      return rejectWithValue(`Too many attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`);
    }

    const stored = await getPinHash();
    if (!stored) return rejectWithValue("No PIN configured. Set one in your profile.");

    const hash = await hashPin(pin, stored.salt);
    if (hash !== stored.hash) return rejectWithValue("Incorrect PIN");

    return true;
  }
);

/** Set up the stealth PIN for the first time */
export const setupPin = createAsyncThunk(
  "auth/setupPin",
  async (pin: string, { rejectWithValue }) => {
    try {
      const salt = generateSalt();
      const hash = await hashPin(pin, salt);
      await storePinHash(hash, salt);
      return true;
    } catch (err) {
      return rejectWithValue("Failed to set PIN");
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Called by the Supabase auth state listener */
    setSessionFromListener(
      state,
      action: PayloadAction<{ session: Session | null; user: User | null }>
    ) {
      state.session = action.payload.session;
      state.user = action.payload.user;
      if (!action.payload.user) {
        state.profile = null;
        state.isNiaUnlocked = false;
        state.niaSessionExpiresAt = null;
      }
    },

    setProfile(state, action: PayloadAction<Profile | null>) {
      state.profile = action.payload as Profile | null;
    },

    /** Lock the Nia hidden platform (does not sign out) */
    lockNia(state) {
      state.isNiaUnlocked = false;
      state.niaSessionExpiresAt = null;
    },

    clearError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // ── initializeAuth ────────────────────────────────────────────────────────
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isInitializing = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.profile = action.payload.profile as Profile | null;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isInitializing = false;
      });

    // ── signInWithEmail ───────────────────────────────────────────────────────
    builder
      .addCase(signInWithEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.profile = action.payload.profile as Profile | null;
      })
      .addCase(signInWithEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ── signUpWithEmail ───────────────────────────────────────────────────────
    builder
      .addCase(signUpWithEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signUpWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.profile = action.payload.profile as Profile | null;
      })
      .addCase(signUpWithEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ── signOut ───────────────────────────────────────────────────────────────
    builder
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.session = null;
        state.profile = null;
        state.isNiaUnlocked = false;
        state.niaSessionExpiresAt = null;
        state.error = null;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // ── sendPasswordReset ─────────────────────────────────────────────────────
    builder
      .addCase(sendPasswordReset.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendPasswordReset.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(sendPasswordReset.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ── updatePassword ────────────────────────────────────────────────────────
    builder
      .addCase(updatePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePassword.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updatePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ── fetchProfile ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.isProfileLoading = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isProfileLoading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.isProfileLoading = false;
      });

    // ── verifyPin ─────────────────────────────────────────────────────────────
    builder
      .addCase(verifyPin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyPin.fulfilled, (state) => {
        state.isLoading = false;
        state.isNiaUnlocked = true;
        state.pinFailedAttempts = 0;
        state.pinLockedUntil = null;
        // Unlock expires after 8 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        state.niaSessionExpiresAt = expiresAt.toISOString();
      })
      .addCase(verifyPin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.pinFailedAttempts += 1;
        // Lock after 5 failed attempts for 30 minutes
        if (state.pinFailedAttempts >= 5) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + 30);
          state.pinLockedUntil = lockUntil.toISOString();
          state.pinFailedAttempts = 0;
        }
      });

    // ── setupPin ──────────────────────────────────────────────────────────────
    builder
      .addCase(setupPin.fulfilled, (state) => {
        state.isNiaUnlocked = true;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        state.niaSessionExpiresAt = expiresAt.toISOString();
      });
  },
});

export const { setSessionFromListener, setProfile, lockNia, clearError } =
  authSlice.actions;

export default authSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectUser = (s: { auth: AuthState }) => s.auth.user;
export const selectSession = (s: { auth: AuthState }) => s.auth.session;
export const selectProfile = (s: { auth: AuthState }) => s.auth.profile;
export const selectIsAuthenticated = (s: { auth: AuthState }) => !!s.auth.user && !!s.auth.session;
export const selectIsLoading = (s: { auth: AuthState }) => s.auth.isLoading;
export const selectIsInitializing = (s: { auth: AuthState }) => s.auth.isInitializing;
export const selectIsNiaUnlocked = (s: { auth: AuthState }) => s.auth.isNiaUnlocked;
export const selectAuthError = (s: { auth: AuthState }) => s.auth.error;
