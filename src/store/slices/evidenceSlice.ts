// src/store/slices/evidenceSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EvidenceState, UploadQueueItem } from "@/types";

const initialState: EvidenceState = {
  uploadQueue: [],
  isUploading: false,
};

const evidenceSlice = createSlice({
  name: "evidence",
  initialState,
  reducers: {
    addToQueue(state, action: PayloadAction<UploadQueueItem>) {
      state.uploadQueue.push(action.payload);
    },
    updateQueueItem(
      state,
      action: PayloadAction<{ id: string; updates: Partial<UploadQueueItem> }>
    ) {
      const item = state.uploadQueue.find((i) => i.id === action.payload.id);
      if (item) Object.assign(item, action.payload.updates);
    },
    removeFromQueue(state, action: PayloadAction<string>) {
      state.uploadQueue = state.uploadQueue.filter((i) => i.id !== action.payload);
    },
    clearCompletedUploads(state) {
      state.uploadQueue = state.uploadQueue.filter(
        (i) => i.status !== "success"
      );
    },
    setIsUploading(state, action: PayloadAction<boolean>) {
      state.isUploading = action.payload;
    },
  },
});

export const {
  addToQueue,
  updateQueueItem,
  removeFromQueue,
  clearCompletedUploads,
  setIsUploading,
} = evidenceSlice.actions;
export default evidenceSlice.reducer;
