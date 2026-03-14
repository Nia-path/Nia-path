// src/hooks/useEmergency.ts
import { useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppDispatch, useEmergencyState, useCurrentUser } from "@/store/hooks";
import {
  activateEmergency,
  deactivateEmergency,
  setRecording,
  setHasLocation,
  addRecordingToSession,
  markAlertSent,
} from "@/store/slices/emergencySlice";
import { getCurrentLocation } from "@/utils";
import toast from "react-hot-toast";

export function useEmergency() {
  const dispatch = useAppDispatch();
  const emergencyState = useEmergencyState();
  const user = useCurrentUser();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startEmergency = useCallback(async () => {
    const sessionId = uuidv4();

    const session = {
      id: sessionId,
      started_at: new Date().toISOString(),
      recordings: [],
      photos: [],
      alert_sent: false,
      contacts_notified: [],
    };

    dispatch(activateEmergency(session));

    // Capture location
    try {
      const coords = await getCurrentLocation();
      dispatch(setHasLocation(true));
      toast.success("Location captured");

      // In production: send coords to backend / n8n workflow
      await fetch("/api/emergency/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: user?.id,
          lat: coords.latitude,
          lng: coords.longitude,
          contacts: user?.emergency_contacts ?? [],
        }),
      }).catch(() => null); // Non-blocking

      dispatch(markAlertSent());
    } catch {
      toast("Could not capture location", { icon: "⚠️" });
    }

    // Start audio recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        dispatch(addRecordingToSession(url));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000);
      dispatch(setRecording(true));
      toast.success("Emergency mode active — recording started");
    } catch {
      toast.error("Could not start audio recording");
    }
  }, [dispatch, user]);

  const stopEmergency = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    dispatch(setRecording(false));
    dispatch(deactivateEmergency());
    toast("Emergency mode deactivated", { icon: "🔒" });
  }, [dispatch]);

  return {
    emergencyState,
    startEmergency,
    stopEmergency,
    isActive: emergencyState.isActive,
    isRecording: emergencyState.isRecording,
  };
}
