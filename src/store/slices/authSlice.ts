// src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState, User } from "@/types";
import { hashPin, generateSalt } from "@/lib/crypto";
import { storePinHash, getPinHash } from "@/lib/db";

const initialState: AuthState = {
  user: null,
  isLoading: false,
  isNiaUnlocked: false,
  sessionExpiresAt: null,
};

export const setupPin = createAsyncThunk(
  "auth/setupPin",
  async (pin: string) => {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);
    await storePinHash(hash, salt);
    return { success: true };
  }
);

export const verifyPin = createAsyncThunk(
  "auth/verifyPin",
  async (pin: string, { rejectWithValue }) => {
    const stored = await getPinHash();
    if (!stored) return rejectWithValue("No PIN configured");
    const hash = await hashPin(pin, stored.salt);
    if (hash !== stored.hash) return rejectWithValue("Incorrect PIN");
    return { success: true };
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    setNiaUnlocked(state, action: PayloadAction<boolean>) {
      state.isNiaUnlocked = action.payload;
      if (action.payload) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        state.sessionExpiresAt = expiresAt.toISOString();
      } else {
        state.sessionExpiresAt = null;
      }
    },
    lockNia(state) {
      state.isNiaUnlocked = false;
      state.sessionExpiresAt = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifyPin.pending, (state) => { state.isLoading = true; })
      .addCase(verifyPin.fulfilled, (state) => {
        state.isLoading = false;
        state.isNiaUnlocked = true;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        state.sessionExpiresAt = expiresAt.toISOString();
      })
      .addCase(verifyPin.rejected, (state) => { state.isLoading = false; });
  },
});

export const { setUser, setNiaUnlocked, lockNia, setLoading } = authSlice.actions;
export default authSlice.reducer;
