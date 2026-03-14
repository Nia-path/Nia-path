// src/store/slices/casesSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Case, CasesState } from "@/types";

const initialState: CasesState = {
  activeCase: null,
  isCreating: false,
};

const casesSlice = createSlice({
  name: "cases",
  initialState,
  reducers: {
    setActiveCase(state, action: PayloadAction<Case | null>) {
      state.activeCase = action.payload;
    },
    setIsCreating(state, action: PayloadAction<boolean>) {
      state.isCreating = action.payload;
    },
    updateActiveCaseStatus(state, action: PayloadAction<Case["status"]>) {
      if (state.activeCase) {
        state.activeCase.status = action.payload;
        state.activeCase.updated_at = new Date().toISOString();
      }
    },
    incrementEvidenceCount(state) {
      if (state.activeCase) {
        state.activeCase.evidence_count += 1;
      }
    },
  },
});

export const {
  setActiveCase,
  setIsCreating,
  updateActiveCaseStatus,
  incrementEvidenceCount,
} = casesSlice.actions;
export default casesSlice.reducer;
