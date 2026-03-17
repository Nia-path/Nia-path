// src/store/hooks.ts
// Typed Redux hooks. REPLACE the existing src/store/hooks.ts with this file.

import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

// ─── Core typed hooks ─────────────────────────────────────────────────────────

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ─── Auth selectors ───────────────────────────────────────────────────────────

export const useCurrentUser = () => useAppSelector((s) => s.auth.user);
export const useCurrentProfile = () => useAppSelector((s) => s.auth.profile);
export const useSession = () => useAppSelector((s) => s.auth.session);
export const useIsAuthenticated = () =>
  useAppSelector((s) => !!s.auth.user && !!s.auth.session);
export const useIsInitializing = () => useAppSelector((s) => s.auth.isInitializing);
export const useIsAuthLoading = () => useAppSelector((s) => s.auth.isLoading);
export const useAuthError = () => useAppSelector((s) => s.auth.error);
export const useIsNiaUnlocked = () => useAppSelector((s) => s.auth.isNiaUnlocked);
export const useNiaSessionExpiresAt = () =>
  useAppSelector((s) => s.auth.niaSessionExpiresAt);

// ─── Existing selectors (unchanged) ──────────────────────────────────────────

export const useActiveCase = () => useAppSelector((s) => s.cases.activeCase);
export const useUploadQueue = () => useAppSelector((s) => s.evidence.uploadQueue);
export const useEmergencyState = () => useAppSelector((s) => s.emergency);
export const useHelpCenterState = () => useAppSelector((s) => s.helpCenter);
