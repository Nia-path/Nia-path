// src/hooks/useAuth.ts


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppDispatch, useCurrentUser, useCurrentProfile } from "@/store/hooks";
import {
  signOut,
  fetchProfile,
  setProfile,
  clearError,
} from "@/store/slices/authSlice";
import type { User } from "@/types";
import type { ProfileUpdate } from "@/types/database";
import toast from "react-hot-toast";

const supabase = createClient();

// ─── Query keys ───────────────────────────────────────────────────────────────

export const authQueryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  session: () => ["auth", "session"] as const,
};

// ─── Profile query ────────────────────────────────────────────────────────────

/**
 * Fetches the current user's profile from Supabase.
 * Hydrates Redux when data arrives.
 * Skips the fetch if the user is not authenticated.
 */
export function useProfile() {
  const dispatch = useAppDispatch();
  const user = useCurrentUser();

  return useQuery({
    queryKey: authQueryKeys.profile(user?.id ?? ""),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // Keep Redux in sync with the latest DB value
      dispatch(setProfile(data));
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,   // 5 min
    gcTime: 1000 * 60 * 30,     // 30 min
    refetchOnWindowFocus: true,  // Re-fetch if user returns to tab
  });
}

// ─── Profile update mutation ──────────────────────────────────────────────────

/**
 * Updates the user's profile record.
 * Optimistically updates Redux and invalidates the query cache.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const user = useCurrentUser();
  const profile = useCurrentProfile();

  return useMutation({
    mutationFn: async (updates: ProfileUpdate) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await (supabase
        .from("profiles") as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (updates) => {
      // Optimistic update
      if (profile) {
        dispatch(setProfile({ ...profile, ...updates } as typeof profile));
      }
    },
    onSuccess: (updatedProfile) => {
      dispatch(setProfile(updatedProfile));
      queryClient.setQueryData(
        authQueryKeys.profile(user?.id ?? ""),
        updatedProfile
      );
      toast.success("Profile updated");
    },
    onError: (error: Error) => {
      // Rollback — re-fetch to restore true state
      if (user) dispatch(fetchProfile(user.id));
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });
}

// ─── Avatar upload mutation ───────────────────────────────────────────────────

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");

      // Validate image
      const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
      if (!ALLOWED.includes(file.type)) {
        throw new Error("Only JPEG, PNG, and WebP images are allowed");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Image must be smaller than 2MB");
      }

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      // Add cache-buster so the browser shows the new image immediately
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Persist to profile record
      const { data: updatedProfile, error: updateError } = await (supabase
        .from("profiles") as any)
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedProfile;
    },
    onSuccess: (updatedProfile) => {
      dispatch(setProfile(updatedProfile));
      queryClient.setQueryData(
        authQueryKeys.profile(user?.id ?? ""),
        updatedProfile
      );
      toast.success("Avatar updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ─── Sign out hook ────────────────────────────────────────────────────────────

/**
 * Returns a sign-out function that clears Redux, the query cache, and
 * redirects to the sign-in page.
 */
export function useSignOut() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(async () => {
    // Clear all cached queries — they may contain private data
    queryClient.clear();
    dispatch(clearError());
    await dispatch(signOut());
    router.replace("/auth/sign-in");
  }, [dispatch, queryClient, router]);
}

// ─── Email verification check ─────────────────────────────────────────────────

/**
 * Returns whether the current user's email has been confirmed.
 * Useful for showing a "verify your email" banner.
 */
export function useEmailVerified() {
  const user = useCurrentUser();
  return !!user?.email_confirmed_at;
}
