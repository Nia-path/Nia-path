// src/store/slices/emergencySliceExtended.ts
// Extends the existing emergencySlice with silent distress + location tracking

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type {
  EmergencyStateExtended,
  EmergencyLocation,
  EmergencySessionExtended,
  GeolocationCoordinatesSnapshot,
  SilentDistressState,
} from "@/types/extensions";
import { getCurrentLocation } from "@/utils";

const SILENT_DISTRESS_THRESHOLD = 3;   // taps required
const SILENT_DISTRESS_WINDOW_MS = 2000; // within 2 seconds

const initialSilentState: SilentDistressState = {
  tapCount: 0,
  firstTapAt: null,
  lastTapAt: null,
  isWindowOpen: false,
  threshold: SILENT_DISTRESS_THRESHOLD,
  windowMs: SILENT_DISTRESS_WINDOW_MS,
};

const initialState: EmergencyStateExtended = {
  isActive: false,
  isSilentMode: false,
  session: null,
  isRecording: false,
  hasLocation: false,
  currentLocation: null,
  locationHistory: [],
  silentDistress: initialSilentState,
};

// Thunk: start location tracking loop during emergency
export const startLocationTracking = createAsyncThunk(
  "emergency/startLocationTracking",
  async (sessionId: string, { dispatch, rejectWithValue }) => {
    try {
      const coords = await getCurrentLocation();
      const snapshot: GeolocationCoordinatesSnapshot = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        heading: coords.heading,
        speed: coords.speed,
        timestamp: Date.now(),
      };
      dispatch(setCurrentLocation(snapshot));

      // Post to API (non-blocking from UI perspective)
      fetch("/api/emergency/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy_m: coords.accuracy,
          altitude_m: coords.altitude,
          heading_deg: coords.heading,
          speed_ms: coords.speed,
        }),
      }).catch(() => null); // Fire-and-forget

      return snapshot;
    } catch (err) {
      return rejectWithValue("Location unavailable");
    }
  }
);

const emergencySliceExtended = createSlice({
  name: "emergency",
  initialState,
  reducers: {
    activateEmergency(
      state,
      action: PayloadAction<{ session: EmergencySessionExtended; silent?: boolean }>
    ) {
      state.isActive = true;
      state.isSilentMode = action.payload.silent ?? false;
      state.session = action.payload.session;
      state.silentDistress = initialSilentState;
    },

    deactivateEmergency(state) {
      state.isActive = false;
      state.isSilentMode = false;
      state.session = null;
      state.isRecording = false;
      state.hasLocation = false;
      state.locationHistory = [];
      state.silentDistress = initialSilentState;
    },

    setRecording(state, action: PayloadAction<boolean>) {
      state.isRecording = action.payload;
    },

    setCurrentLocation(state, action: PayloadAction<GeolocationCoordinatesSnapshot>) {
      state.currentLocation = action.payload;
      state.hasLocation = true;
    },

    appendLocationHistory(state, action: PayloadAction<EmergencyLocation>) {
      state.locationHistory.push(action.payload);
      // Cap at 500 points to avoid memory issues
      if (state.locationHistory.length > 500) {
        state.locationHistory = state.locationHistory.slice(-500);
      }
    },

    markAlertSent(state) {
      if (state.session) {
        state.session.alert_sent = true;
        state.session.alert_sent_at = new Date().toISOString();
      }
    },

    // ── Silent distress tap tracking ──────────────────────────────────────────

    recordSosTap(state) {
      const now = Date.now();
      const sd = state.silentDistress;

      if (!sd.firstTapAt || now - sd.firstTapAt > sd.windowMs) {
        // Start fresh window
        sd.tapCount = 1;
        sd.firstTapAt = now;
        sd.lastTapAt = now;
        sd.isWindowOpen = true;
      } else {
        sd.tapCount += 1;
        sd.lastTapAt = now;
      }
    },

    resetSosTaps(state) {
      state.silentDistress = initialSilentState;
    },

    markSilentSMSSent(state) {
      if (state.session) {
        state.session.silent_sms_sent = true;
        state.session.silent_sms_sent_at = new Date().toISOString();
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(startLocationTracking.fulfilled, (state, action) => {
        state.currentLocation = action.payload;
        state.hasLocation = true;
      })
      .addCase(startLocationTracking.rejected, (state) => {
        state.hasLocation = false;
      });
  },
});

export const {
  activateEmergency,
  deactivateEmergency,
  setRecording,
  setCurrentLocation,
  appendLocationHistory,
  markAlertSent,
  recordSosTap,
  resetSosTaps,
  markSilentSMSSent,
} = emergencySliceExtended.actions;

export default emergencySliceExtended.reducer;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectSilentDistressShouldTrigger = (state: { emergency: EmergencyStateExtended }) => {
  const sd = state.emergency.silentDistress;
  const now = Date.now();
  return (
    sd.tapCount >= sd.threshold &&
    sd.firstTapAt !== null &&
    now - sd.firstTapAt <= sd.windowMs
  );
};

export const selectIsEmergencyActive = (s: { emergency: EmergencyStateExtended }) =>
  s.emergency.isActive;

export const selectIsSilentMode = (s: { emergency: EmergencyStateExtended }) =>
  s.emergency.isSilentMode;

export const selectCurrentLocation = (s: { emergency: EmergencyStateExtended }) =>
  s.emergency.currentLocation;

export const selectLocationHistory = (s: { emergency: EmergencyStateExtended }) =>
  s.emergency.locationHistory;
