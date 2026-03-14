// src/store/slices/emergencySlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EmergencyState, EmergencySession } from "@/types";

const initialState: EmergencyState = {
  isActive: false,
  session: null,
  isRecording: false,
  hasLocation: false,
};

const emergencySlice = createSlice({
  name: "emergency",
  initialState,
  reducers: {
    activateEmergency(state, action: PayloadAction<EmergencySession>) {
      state.isActive = true;
      state.session = action.payload;
    },
    deactivateEmergency(state) {
      state.isActive = false;
      state.session = null;
      state.isRecording = false;
      state.hasLocation = false;
    },
    setRecording(state, action: PayloadAction<boolean>) {
      state.isRecording = action.payload;
    },
    setHasLocation(state, action: PayloadAction<boolean>) {
      state.hasLocation = action.payload;
    },
    addRecordingToSession(state, action: PayloadAction<string>) {
      if (state.session) {
        state.session.recordings.push(action.payload);
      }
    },
    markAlertSent(state) {
      if (state.session) {
        state.session.alert_sent = true;
      }
    },
    addNotifiedContact(state, action: PayloadAction<string>) {
      if (state.session) {
        state.session.contacts_notified.push(action.payload);
      }
    },
  },
});

export const {
  activateEmergency,
  deactivateEmergency,
  setRecording,
  setHasLocation,
  addRecordingToSession,
  markAlertSent,
  addNotifiedContact,
} = emergencySlice.actions;
export default emergencySlice.reducer;
