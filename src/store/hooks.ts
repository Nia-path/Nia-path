// src/store/hooks.ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Composed selectors
export const useCurrentUser = () => useAppSelector((s) => s.auth.user);
export const useIsNiaUnlocked = () => useAppSelector((s) => s.auth.isNiaUnlocked);
export const useActiveCase = () => useAppSelector((s) => s.cases.activeCase);
export const useUploadQueue = () => useAppSelector((s) => s.evidence.uploadQueue);
export const useEmergencyState = () => useAppSelector((s) => s.emergency);
