// src/store/index.ts
// Root Redux store. Adds authReducer alongside all existing slices.
// REPLACE the existing src/store/index.ts with this file.

import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import casesReducer from "./slices/casesSlice";
import evidenceReducer from "./slices/evidenceSlice";
import emergencyReducer from "./slices/emergencySliceExtended";
import helpCenterReducer from "./slices/helpCenterSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,          // ← NEW
    cases: casesReducer,
    evidence: evidenceReducer,
    emergency: emergencyReducer,
    helpCenter: helpCenterReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // File objects in upload queue are non-serializable
        ignoredPaths: ["evidence.uploadQueue"],
        ignoredActions: ["evidence/addToQueue"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
