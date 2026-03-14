// src/hooks/useExtendedFeatures.ts
// TanStack Query hooks for all 5 feature extensions

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/queryClient";
import {
  setUserLocation,
  setLocationPermission,
} from "@/store/slices/helpCenterSlice";
import {
  appendLocationHistory,
  recordSosTap,
  resetSosTaps,
  selectSilentDistressShouldTrigger,
} from "@/store/slices/emergencySliceExtended";
import { triggerEmergencySOS, triggerSilentDistress, triggerEvidenceUploaded } from "@/lib/workflows";
import type {
  HelpServiceExtended,
  NearbyServicesRequest,
  EvidenceUploadPayload,
  LocationUpdateRequest,
  RiskAssessment,
  DeviceMetadata,
} from "@/types/extensions";
import toast from "react-hot-toast";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: AI RISK DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: send message and get risk-assessed response */
export function useAiChatWithRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      message: string;
      conversationId: string;
      history: Array<{ role: string; content: string }>;
    }) => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: payload.message,
          conversation_id: payload.conversationId,
          history: payload.history,
        }),
      });
      if (!res.ok) throw new Error("AI chat request failed");
      return res.json();
    },
    onSuccess: async (data, vars) => {
      const risk: RiskAssessment | undefined = data.risk_assessment;

      // Trigger n8n escalation for HIGH or CRITICAL risk
      if (risk && (risk.level === "high" || risk.level === "critical")) {
        triggerWorkflow("ai_risk_escalation", {
          message_id: data.message_id,
          conversation_id: vars.conversationId,
          risk_level: risk.level,
          immediate_danger: risk.immediate_danger,
          content: vars.message.slice(0, 300),
          recommended_steps: risk.recommended_steps,
        }).catch(() => null); // Non-blocking
      }

      queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
    },
  });
}

/** Hook: get conversation risk history */
export function useConversationRisk(conversationId: string) {
  return useQuery({
    queryKey: ["conversation_risk", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_messages")
        .select("id, risk_level, risk_score, risk_category, risk_flags, created_at")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .not("risk_level", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!conversationId,
    staleTime: 1000 * 30,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: SILENT DISTRESS MODE
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: SOS button with silent distress detection */
export function useSosButton() {
  const dispatch = useAppDispatch();
  const shouldTriggerSilent = useAppSelector(selectSilentDistressShouldTrigger);
  const silentTriggeredRef = useRef(false);

  const handleSosTap = useCallback(
    async (opts: {
      userId: string;
      lat: number | null;
      lng: number | null;
      onNormalSos: () => void;
      onSilentTriggered: () => void;
    }) => {
      dispatch(recordSosTap());

      // Check AFTER recording tap
      if (shouldTriggerSilent && !silentTriggeredRef.current) {
        silentTriggeredRef.current = true;

        // Fire silent distress — no UI feedback
        await triggerSilentDistress({
          lat: opts.lat,
          lng: opts.lng,
          tap_count: 3,
        }).catch(() => null);

        dispatch(resetSosTaps());
        opts.onSilentTriggered();

        // Reset the guard after a cool-down
        setTimeout(() => { silentTriggeredRef.current = false; }, 10000);
      }
      // Normal single-tap SOS handled by parent
    },
    [dispatch, shouldTriggerSilent]
  );

  const handleSingleSos = useCallback(
    (opts: { userId: string; lat: number | null; lng: number | null }) => {
      dispatch(resetSosTaps());
      triggerEmergencySOS({
        session_id: crypto.randomUUID(),
        lat: opts.lat,
        lng: opts.lng,
        contacts: [],
      }).catch(() => null);
    },
    [dispatch]
  );

  return { handleSosTap, handleSingleSos };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: EMERGENCY LOCATION SHARING
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: continuous location tracking during emergency */
export function useEmergencyLocationTracking(sessionId: string | null, active: boolean) {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !sessionId) {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const postLocation = async (coords: GeolocationCoordinates) => {
      const payload: LocationUpdateRequest = {
        session_id: sessionId,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy_m: coords.accuracy,
        altitude_m: coords.altitude ?? undefined,
        heading_deg: coords.heading ?? undefined,
        speed_ms: coords.speed ?? undefined,
        battery_level: await getBatteryLevel(),
        device_type: "GPS",
      };

      try {
        await fetch("/api/emergency/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch { /* offline — location still tracked in state */ }
    };

    // Use watchPosition for real-time updates
    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          dispatch(appendLocationHistory({
            id: Date.now(),
            session_id: sessionId,
            user_id: "",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
            altitude_m: pos.coords.altitude ?? undefined,
            heading_deg: pos.coords.heading ?? undefined,
            speed_ms: pos.coords.speed ?? undefined,
            google_maps_url: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`,
            shared_with: [],
            share_count: 0,
            captured_at: new Date().toISOString(),
            received_at: new Date().toISOString(),
          }));
          postLocation(pos.coords);
        },
        null,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [active, sessionId, dispatch]);
}

/** Hook: fetch location history for a session */
export function useEmergencyLocationHistory(sessionId: string | null) {
  return useQuery({
    queryKey: ["emergency_locations", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data } = await supabase
        .from("emergency_locations")
        .select("*")
        .eq("session_id", sessionId)
        .order("captured_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5s during active emergency
    staleTime: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: EVIDENCE WITH VERIFICATION METADATA
// ─────────────────────────────────────────────────────────────────────────────

/** Compute SHA-256 checksum of a File in the browser */
async function computeFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Collect device metadata for evidence upload */
async function collectDeviceMetadata(): Promise<DeviceMetadata> {
  const ua = navigator.userAgent;
  const uaHash = await computeSha256(ua);
  const platform = /android/i.test(ua)
    ? "android"
    : /iphone|ipad/i.test(ua)
    ? "ios"
    : "web";

  const networkType =
    (navigator as unknown as { connection?: { effectiveType?: string } })
      .connection?.effectiveType === "4g"
      ? "cellular"
      : "wifi";

  return {
    platform,
    os_version: navigator.platform,
    user_agent_hash: uaHash,
    network_type: networkType,
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
  };
}

async function computeSha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hook: upload evidence with full verification metadata */
export function useEvidenceUploadWithVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: EvidenceUploadPayload) => {
      // 1. Compute checksum client-side
      const checksum = payload.checksum_sha256 || (await computeFileChecksum(payload.file));
      const deviceMeta = payload.device_metadata || (await collectDeviceMetadata());

      const formData = new FormData();
      formData.append("file", payload.file);
      formData.append("case_id", payload.case_id);
      formData.append("evidence_type", payload.evidence_type);
      formData.append("checksum_sha256", checksum);
      formData.append("device_metadata", JSON.stringify(deviceMeta));
      if (payload.description) formData.append("description", payload.description);
      if (payload.location_lat != null)
        formData.append("location_lat", String(payload.location_lat));
      if (payload.location_lng != null)
        formData.append("location_lng", String(payload.location_lng));

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["evidence", data.evidence?.case_id],
      });
      // Trigger n8n verification workflow
      if (data.evidence) {
        triggerEvidenceUploaded({
          evidence_id: data.evidence.id,
          case_id: data.evidence.case_id,
          evidence_type: data.evidence.type,
          file_name: data.evidence.file_name,
          mime_type: data.evidence.mime_type,
          file_size: data.evidence.file_size,
          storage_path: data.evidence.storage_path,
          storage_bucket: data.evidence.storage_bucket,
          checksum_sha256: data.evidence.checksum_sha256,
        }).catch(() => null);
      }
    },
    onError: () => toast.error("Evidence upload failed"),
  });
}

/** Hook: poll verification status for a piece of evidence */
export function useEvidenceVerificationStatus(evidenceId: string | null) {
  return useQuery({
    queryKey: ["evidence_verification", evidenceId],
    queryFn: async () => {
      if (!evidenceId) return null;
      const { data } = await supabase
        .from("evidence")
        .select(
          "id, verification_status, checksum_verified, checksum_verified_at, " +
          "is_tamper_evident, device_platform, device_model, verification_error"
        )
        .eq("id", evidenceId)
        .single();
      return data;
    },
    enabled: !!evidenceId,
    // Poll until verified or failed
    refetchInterval: (query) => {
      const status = (query.state.data as { verification_status?: string } | null)?.verification_status;
      if (!status || status === "pending" || status === "verifying") return 3000;
      return false;
    },
    staleTime: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: NEARBY HELP ROUTING
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: get user geolocation and store in Redux */
export function useUserGeolocation() {
  const dispatch = useAppDispatch();

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      dispatch(setLocationPermission("denied"));
      return null;
    }

    return new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          dispatch(setLocationPermission("granted"));
          dispatch(setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          }));
          resolve(pos);
        },
        () => {
          dispatch(setLocationPermission("denied"));
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    });
  }, [dispatch]);

  return { requestLocation };
}

/** Hook: fetch nearby help services using DB function */
export function useNearbyHelpServices(params: NearbyServicesRequest | null) {
  return useQuery({
    queryKey: ["nearby_services", params],
    queryFn: async () => {
      if (!params) return [];
      const { data, error } = await supabase.rpc("get_nearby_help_services", {
        user_lat: params.lat,
        user_lng: params.lng,
        radius_km: params.radius_km ?? 30,
        service_type: params.service_type ?? null,
        emergency_only: params.emergency_only ?? false,
        result_limit: 25,
      });
      if (error) throw error;
      return (data ?? []) as HelpServiceExtended[];
    },
    enabled: !!params?.lat && !!params?.lng,
    staleTime: 1000 * 60 * 5, // 5 min
    gcTime: 1000 * 60 * 30,
  });
}

/** Hook: log a service search for analytics */
export function useLogServiceSearch() {
  return useMutation({
    mutationFn: async (payload: {
      lat: number;
      lng: number;
      radius_km: number;
      service_type?: string;
      results_count: number;
    }) => {
      const { error } = await supabase.from("service_searches").insert({
        search_lat: payload.lat,
        search_lng: payload.lng,
        radius_km: payload.radius_km,
        service_type: payload.service_type ?? null,
        results_count: payload.results_count,
      });
      if (error) throw error;
    },
    retry: 0,
  });
}

/** Hook: log when user taps "Call" on a service */
export function useLogServiceCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { serviceId: string; searchId?: number }) => {
      if (!params.searchId) return;
      const { data: existing } = await supabase
        .from("service_searches")
        .select("called_ids")
        .eq("id", params.searchId)
        .single();

      if (existing) {
        await supabase
          .from("service_searches")
          .update({
            called_ids: [...new Set([...(existing.called_ids ?? []), params.serviceId])],
          })
          .eq("id", params.searchId);
      }
    },
    retry: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Battery level (best-effort)
// ─────────────────────────────────────────────────────────────────────────────

async function getBatteryLevel(): Promise<number | undefined> {
  try {
    const battery = await (
      navigator as unknown as {
        getBattery?: () => Promise<{ level: number }>;
      }
    ).getBattery?.();
    return battery ? Math.round(battery.level * 100) : undefined;
  } catch {
    return undefined;
  }
}

// Re-export triggerWorkflow for convenience
async function triggerWorkflow(event: string, data: Record<string, unknown>) {
  return fetch("/api/trigger-workflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data }),
  }).catch(() => null);
}
