// src/app/(nia)/emergency/page.tsx
// Enhanced emergency page with:
//   - Silent distress mode (multi-tap detection)
//   - Live location tracking
//   - Location history mini-map (CSS)
//   - Improved visual feedback

"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  activateEmergency,
  deactivateEmergency,
  setRecording,
  markAlertSent,
  recordSosTap,
  resetSosTaps,
  selectSilentDistressShouldTrigger,
  selectIsEmergencyActive,
  selectIsSilentMode,
  selectCurrentLocation,
  startLocationTracking,
} from "@/store/slices/emergencySliceExtended";
import {
  useEmergencyLocationTracking,
  useEmergencyLocationHistory,
} from "@/hooks/useExtendedFeatures";
import { useCurrentUser } from "@/store/hooks";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, formatRelativeTime } from "@/utils";
import { triggerEmergencySOS, triggerSilentDistress } from "@/lib/workflows";
import toast from "react-hot-toast";
import type { GeolocationCoordinatesSnapshot } from "@/types/extensions";
import {
  Siren, Mic, MapPin, Phone, Users,
  CheckCircle, Clock, ShieldAlert, Battery,
  Navigation, EyeOff, Zap,
} from "lucide-react";

const SILENT_THRESHOLD = 3;
const SILENT_WINDOW_MS = 2000;

export default function EmergencyPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useCurrentUser();
  const isActive = useAppSelector(selectIsEmergencyActive);
  const isSilent = useAppSelector(selectIsSilentMode);
  const currentLocation = useAppSelector(selectCurrentLocation) as GeolocationCoordinatesSnapshot | null;

  const sessionIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const tapCountRef = useRef(0);
  const firstTapRef = useRef<number | null>(null);
  const tapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isRecording, setIsRecordingLocal] = useState(false);
  const [silentTriggered, setSilentTriggered] = useState(false);
  const [tapVisual, setTapVisual] = useState(0); // for tap count UI feedback

  // Location tracking (active only during emergency)
  useEmergencyLocationTracking(sessionIdRef.current, isActive as boolean);

  const { data: locationHistory } = useEmergencyLocationHistory(
    isActive ? sessionIdRef.current : null
  );

  // ── SOS tap handler with silent distress detection ──────────────────────────
  const handleSosTap = useCallback(async () => {
    const now = Date.now();

    if (!firstTapRef.current || now - firstTapRef.current > SILENT_WINDOW_MS) {
      tapCountRef.current = 1;
      firstTapRef.current = now;
    } else {
      tapCountRef.current += 1;
    }

    setTapVisual(tapCountRef.current);
    dispatch(recordSosTap());

    // Clear tap count after window
    if (tapResetRef.current) clearTimeout(tapResetRef.current);
    tapResetRef.current = setTimeout(() => {
      tapCountRef.current = 0;
      firstTapRef.current = null;
      setTapVisual(0);
      dispatch(resetSosTaps());
    }, SILENT_WINDOW_MS + 200);

    // Silent distress triggered
    if (tapCountRef.current >= SILENT_THRESHOLD && !silentTriggered) {
      setSilentTriggered(true);
      tapCountRef.current = 0;
      firstTapRef.current = null;

      await triggerSilentDistress({
        lat: currentLocation?.latitude ?? null,
        lng: currentLocation?.longitude ?? null,
        tap_count: SILENT_THRESHOLD,
      }).catch(() => null);

      // No toast, no sound — completely silent
      return;
    }

    // Normal single-tap: start visible emergency
    if (tapCountRef.current === 1 && !isActive) {
      startEmergency(false);
    }
  }, [dispatch, isActive, currentLocation, silentTriggered]);

  // ── Start visible emergency ─────────────────────────────────────────────────
  const startEmergency = useCallback(async (silent: boolean) => {
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;

    const session = {
      id: sessionId,
      user_id: user?.id ?? "",
      started_at: new Date().toISOString(),
      trigger_type: (silent ? "silent_distress" : "manual") as any,
      is_silent: silent,
      tap_count: silent ? SILENT_THRESHOLD : 1,
      silent_sms_sent: false,
      shelter_alert_sent: false,
      shelter_ids_alerted: [],
      ui_suppressed: silent,
      alert_sent: false,
      contacts_alerted: [],
      audio_recordings: [],
      photos_captured: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dispatch(activateEmergency({ session: session as any, silent }));

    // Start location tracking
    dispatch(startLocationTracking(sessionId) as any);

    // Start audio recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecordingLocal(true);
      dispatch(setRecording(true));
    } catch {
      // Microphone access denied — continue without recording
    }

    // Trigger n8n
    await triggerEmergencySOS({
      session_id: sessionId,
      lat: currentLocation?.latitude ?? null,
      lng: currentLocation?.longitude ?? null,
      contacts: user?.emergency_contacts ?? [],
    }).catch(() => null);

    dispatch(markAlertSent());

    if (!silent) {
      toast.success("Emergency mode active");
    }
  }, [dispatch, user, currentLocation]);

  const stopEmergency = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    setIsRecordingLocal(false);
    setSilentTriggered(false);
    sessionIdRef.current = null;
    dispatch(deactivateEmergency());
    dispatch(setRecording(false));
    toast("Emergency mode deactivated", { icon: "🔒" });
  }, [dispatch]);

  // Auto-start on mount if navigated directly
  useEffect(() => {
    if (!isActive) {
      startEmergency(false);
    }
    return () => {
      if (tapResetRef.current) clearTimeout(tapResetRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Main SOS button — tap 3× quickly for silent mode */}
      <div
        className={cn(
          "rounded-3xl p-8 text-center relative overflow-hidden transition-all duration-500 cursor-pointer select-none",
          isActive
            ? "bg-emergency-600 text-white shadow-emergency"
            : "bg-earth-50 border border-earth-200"
        )}
        onClick={handleSosTap}
      >
        {/* Ripple layers for active state */}
        {isActive && (
          <>
            <div className="absolute inset-0 rounded-3xl bg-emergency-500/20 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute inset-4 rounded-2xl bg-emergency-500/10 animate-ping" style={{ animationDuration: "2.5s" }} />
          </>
        )}

        <div className="relative z-10">
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4",
            isActive ? "bg-white/20" : "bg-earth-200"
          )}>
            <Siren className={cn(
              "w-12 h-12 transition-all",
              isActive ? "text-white" : "text-earth-400"
            )} />
          </div>

          <h1 className={cn(
            "font-heading text-2xl font-bold",
            isActive ? "text-white" : "text-earth-700"
          )}>
            {isActive ? "Emergency Active" : "Tap to Activate SOS"}
          </h1>

          <p className={cn(
            "text-sm mt-1",
            isActive ? "text-white/70" : "text-earth-400"
          )}>
            {isActive
              ? "Recording & tracking location"
              : "Tap 3× quickly for silent alert"}
          </p>

          {/* Tap counter feedback */}
          {tapVisual > 0 && tapVisual < SILENT_THRESHOLD && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {Array.from({ length: SILENT_THRESHOLD }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    i < tapVisual ? "bg-nia-400 scale-110" : "bg-earth-200"
                  )}
                />
              ))}
              <span className="text-xs text-earth-400 ml-1">
                {SILENT_THRESHOLD - tapVisual} more for silent
              </span>
            </div>
          )}

          {isRecording && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="w-2.5 h-2.5 bg-white rounded-full animate-recording" />
              <span className="text-sm text-white/90 font-medium">Recording</span>
            </div>
          )}
        </div>
      </div>

      {/* Silent mode confirmation (hidden to others) */}
      {silentTriggered && !isActive && (
        <div className="bg-earth-50 border border-earth-200 rounded-2xl p-4 flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-earth-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-earth-700">Silent alert sent</p>
            <p className="text-xs text-earth-400">Contacts notified discreetly</p>
          </div>
          <div className="ml-auto w-2 h-2 bg-green-400 rounded-full" />
        </div>
      )}

      {/* Active status cards */}
      {isActive && (
        <Card className="space-y-3 animate-slide-up">
          <h2 className="text-sm font-semibold text-earth-700">Active Protections</h2>
          <StatusRow icon={Mic} label="Audio recording" active={isRecording} note={isRecording ? "In progress" : "Unavailable"} />
          <StatusRow
            icon={Navigation}
            label="GPS tracking"
            active={!!currentLocation}
            note={currentLocation
              ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
              : "Acquiring…"
            }
          />
          <StatusRow
            icon={Users}
            label="Contacts alerted"
            active={true}
            note={`${user?.emergency_contacts?.length ?? 0} contact(s) notified`}
          />
          {(locationHistory?.length ?? 0) > 0 && (
            <StatusRow
              icon={MapPin}
              label="Location history"
              active={true}
              note={`${locationHistory!.length} points recorded`}
            />
          )}
        </Card>
      )}

      {/* Location trail mini-visualization */}
      {isActive && (locationHistory?.length ?? 0) > 1 && (
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-nia-600" />
            <p className="text-xs font-semibold text-earth-700">Location Trail</p>
            <span className="ml-auto text-xs text-earth-400">{locationHistory!.length} points</span>
          </div>
          <div className="flex items-end gap-0.5 h-10">
            {locationHistory!.slice(-30).map((loc, i) => (
              <div
                key={loc.id}
                className={cn(
                  "flex-1 rounded-sm transition-all",
                  i === locationHistory!.slice(-30).length - 1
                    ? "bg-emergency-500"
                    : "bg-nia-300"
                )}
                style={{
                  height: `${Math.max(20, Math.min(100, (loc.accuracy_m ?? 10) * 3))}%`,
                  opacity: 0.4 + (i / 30) * 0.6,
                }}
              />
            ))}
          </div>
          <p className="text-[10px] text-earth-400 mt-1 text-center">
            Last update {locationHistory?.[0]
              ? formatRelativeTime(locationHistory[0].captured_at)
              : "—"}
          </p>
        </Card>
      )}

      {/* Quick dial */}
      <Card>
        <h2 className="text-sm font-semibold text-earth-700 mb-3">Quick Dial</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Police", number: "999" },
            { label: "GBV Hotline", number: "1195" },
            { label: "Ambulance", number: "911" },
            { label: "Free Legal Aid", number: "0800720434" },
          ].map(({ label, number }) => (
            <a
              key={number}
              href={`tel:${number}`}
              className="flex flex-col items-center gap-1 py-3 bg-earth-50 hover:bg-earth-100 rounded-xl transition-colors active:scale-95"
            >
              <Phone className="w-4 h-4 text-earth-500" />
              <span className="text-xs font-bold text-earth-900">{number}</span>
              <span className="text-[10px] text-earth-400 text-center leading-tight">{label}</span>
            </a>
          ))}
        </div>
      </Card>

      {/* Silent mode tip */}
      {!isActive && (
        <div className="bg-earth-50 rounded-2xl p-4 border border-earth-100">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-nia-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-earth-700 mb-1">Silent distress mode</p>
              <p className="text-xs text-earth-500 leading-relaxed">
                If you cannot safely press SOS openly, tap it <strong>3 times quickly</strong>.
                Your contacts will be notified without any visible alert on your screen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stop button */}
      {isActive && (
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={stopEmergency}
          className="border border-earth-200"
        >
          Deactivate Emergency Mode
        </Button>
      )}
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  active,
  note,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  note: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
        active ? "bg-green-100" : "bg-earth-100"
      )}>
        <Icon className={cn("w-4 h-4", active ? "text-green-600" : "text-earth-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-earth-800">{label}</p>
        <p className="text-xs text-earth-400 truncate">{note}</p>
      </div>
      {active
        ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        : <Clock className="w-3.5 h-3.5 text-earth-300 animate-spin shrink-0" />
      }
    </div>
  );
}
