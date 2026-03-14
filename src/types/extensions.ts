// src/types/extensions.ts
// Extended types for the 5 feature additions.
// Import and re-export alongside existing src/types/index.ts

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: AI RISK DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskCategory =
  | "domestic_violence"
  | "sexual_violence"
  | "stalking"
  | "financial_coercion"
  | "child_at_risk"
  | "suicidal_ideation"
  | "property_threat"
  | "workplace_threat"
  | "general_distress"
  | "none";

export interface RiskAssessment {
  level: RiskLevel;
  score: number;             // 0.000 – 1.000
  category: RiskCategory;
  flags: string[];           // Specific risk indicators detected
  immediate_danger: boolean;
  recommended_steps: string[];
  should_escalate: boolean;  // Trigger n8n if true
}

// Extended ai_messages row (adds to existing ChatMessage type)
export interface ChatMessageExtended {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  content_language: "en" | "sw";
  model_used?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  // ─── New risk fields ───
  risk_level?: RiskLevel;
  risk_score?: number;
  risk_category?: RiskCategory;
  risk_flags: string[];
  risk_assessed_at?: string;
  escalated_at?: string;
  escalation_workflow_id?: string;
  // ─── Existing structured fields ───
  recommended_steps?: string[];
  suggested_actions?: ChatAction[];
  sequence_number: number;
  created_at: string;
}

export interface ChatAction {
  id: string;
  label: string;
  action: "create_case" | "call_emergency" | "find_shelter" | "upload_evidence" | "generate_report";
  variant: "primary" | "secondary" | "danger";
  icon?: string;
}

// What the AI API route returns
export interface AiChatApiResponse {
  content: string;
  case_category?: string;
  risk_assessment?: RiskAssessment;
  actions?: ChatAction[];
}

// For the risk banner in the chat UI
export interface RiskBannerProps {
  level: RiskLevel;
  category: RiskCategory;
  immediiateDanger: boolean;
  steps: string[];
  onDismiss: () => void;
  onGetHelp: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: SILENT DISTRESS MODE
// ─────────────────────────────────────────────────────────────────────────────

export type EmergencyTriggerType =
  | "manual"
  | "shake_gesture"
  | "voice_command"
  | "scheduled_check"
  | "auto_detect"
  | "silent_distress";

export interface SilentDistressState {
  tapCount: number;
  firstTapAt: number | null;    // timestamp ms
  lastTapAt: number | null;     // timestamp ms
  isWindowOpen: boolean;
  threshold: number;            // taps needed to trigger (default 3)
  windowMs: number;             // detection window (default 2000ms)
}

export interface EmergencySessionExtended {
  id: string;
  user_id: string;
  case_id?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  trigger_type: EmergencyTriggerType;
  // ─── New silent distress fields ───
  is_silent: boolean;
  tap_count?: number;
  tap_window_ms?: number;
  silent_sms_sent: boolean;
  silent_sms_sent_at?: string;
  shelter_alert_sent: boolean;
  shelter_ids_alerted: string[];
  ui_suppressed: boolean;
  // ─── Existing fields ───
  location_lat?: number;
  location_lng?: number;
  location_accuracy_m?: number;
  location_name?: string;
  google_maps_url?: string;
  alert_sent: boolean;
  alert_sent_at?: string;
  contacts_alerted: ContactAlerted[];
  audio_recordings: string[];
  photos_captured: string[];
  outcome?: string;
  outcome_note?: string;
  n8n_execution_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactAlerted {
  name: string;
  phone: string;
  method: "sms" | "whatsapp" | "call";
  sent_at: string;
}

// Redux slice state extension
export interface EmergencyStateExtended {
  isActive: boolean;
  isSilentMode: boolean;
  session: EmergencySessionExtended | null;
  isRecording: boolean;
  hasLocation: boolean;
  currentLocation: GeolocationCoordinatesSnapshot | null;
  locationHistory: EmergencyLocation[];
  silentDistress: SilentDistressState;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: EMERGENCY LOCATION SHARING
// ─────────────────────────────────────────────────────────────────────────────

export interface EmergencyLocation {
  id: number;
  session_id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
  altitude_m?: number;
  heading_deg?: number;
  speed_ms?: number;
  device_type?: "GPS" | "NETWORK" | "PASSIVE";
  battery_level?: number;
  is_moving?: boolean;
  google_maps_url: string;
  shared_with: string[];
  share_count: number;
  captured_at: string;
  received_at: string;
}

export interface GeolocationCoordinatesSnapshot {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationShare {
  id: string;
  session_id: string;
  user_id: string;
  service_id: string;
  lat: number;
  lng: number;
  google_maps_url: string;
  message_sent?: string;
  delivery_method: "sms" | "whatsapp" | "email" | "api";
  delivered: boolean;
  delivered_at?: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  shared_at: string;
}

// API request for posting a location update
export interface LocationUpdateRequest {
  session_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
  altitude_m?: number;
  heading_deg?: number;
  speed_ms?: number;
  battery_level?: number;
  device_type?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: EVIDENCE VERIFICATION METADATA
// ─────────────────────────────────────────────────────────────────────────────

export type VerificationStatus =
  | "pending"
  | "verifying"
  | "verified"
  | "tampered"
  | "unverifiable";

export interface EvidenceExtended {
  id: string;
  case_id?: string;
  user_id: string;
  type: EvidenceType;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  file_url?: string;
  thumbnail_url?: string;
  mime_type: string;
  file_size: number;
  duration_seconds?: number;
  width?: number;
  height?: number;
  description?: string;
  tags: string[];
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  captured_at: string;
  uploaded_at: string;
  // ─── Verification fields ───
  checksum_sha256: string;
  checksum_md5?: string;
  checksum_verified: boolean;
  checksum_verified_at?: string;
  verification_status: VerificationStatus;
  verification_error?: string;
  verification_attempts: number;
  is_tamper_evident: boolean;
  // ─── Device metadata ───
  device_platform?: "android" | "ios" | "web" | "desktop";
  device_model?: string;
  device_os_version?: string;
  app_version?: string;
  network_type?: "wifi" | "cellular" | "offline-sync";
  // ─── EXIF data ───
  exif_data?: Record<string, unknown>;
  exif_gps_lat?: number;
  exif_gps_lng?: number;
  exif_timestamp?: string;
  // ─── Legal status ───
  submitted_to_police: boolean;
  submitted_to_police_at?: string;
  police_ob_number?: string;
  submitted_to_court: boolean;
  submitted_to_court_at?: string;
  court_case_number?: string;
  notarized_at?: string;
  notarization_ref?: string;
  ai_analyzed: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export type EvidenceType =
  | "photo" | "video" | "audio"
  | "document" | "screenshot"
  | "location" | "property_doc";

// Device fingerprint collected at upload time
export interface DeviceMetadata {
  platform: string;
  model?: string;
  os_version?: string;
  app_version?: string;
  network_type?: string;
  user_agent_hash?: string;  // SHA-256 hashed
  ip_hash?: string;          // SHA-256 hashed
}

// Upload payload sent to API
export interface EvidenceUploadPayload {
  file: File;
  case_id: string;
  evidence_type: EvidenceType;
  description?: string;
  location_lat?: number;
  location_lng?: number;
  checksum_sha256: string;    // Computed client-side BEFORE upload
  device_metadata: DeviceMetadata;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: NEARBY HELP ROUTING
// ─────────────────────────────────────────────────────────────────────────────

export type HelpServiceType =
  | "shelter"
  | "legal_aid"
  | "police_gender_desk"
  | "counseling"
  | "medical"
  | "financial_support"
  | "child_protection"
  | "hotline";

export interface HelpServiceExtended {
  id: string;
  name: string;
  slug: string;
  type: HelpServiceType;
  phone: string;
  phone_toll_free?: string;
  whatsapp?: string;
  whatsapp_link?: string;
  email?: string;
  website?: string;
  address: string;
  county: string;
  sub_county?: string;
  lat: number;
  lng: number;
  nearby_landmark?: string;
  hours: string;
  is_24_hour: boolean;
  description: string;
  services_offered: string[];
  languages_supported: string[];
  response_time_minutes?: number;
  has_safe_house: boolean;
  safe_house_capacity?: number;
  accepts_walk_ins: boolean;
  has_legal_clinic: boolean;
  serves_children: boolean;
  verified: boolean;
  rating_average?: number;
  rating_count: number;
  is_at_capacity: boolean;
  is_active: boolean;
  google_maps_place_id?: string;
  // Computed by DB function
  distance_km?: number;
}

export interface NearbyServicesRequest {
  lat: number;
  lng: number;
  radius_km?: number;
  service_type?: HelpServiceType;
  emergency_only?: boolean;
}

export interface ServiceSearch {
  id: number;
  user_id: string;
  search_lat: number;
  search_lng: number;
  radius_km: number;
  service_type?: string;
  results_count?: number;
  clicked_ids: string[];
  called_ids: string[];
  searched_at: string;
}

// Redux slice for help center
export interface HelpCenterState {
  userLocation: GeolocationCoordinatesSnapshot | null;
  locationPermission: "granted" | "denied" | "prompt" | "unknown";
  selectedService: HelpServiceExtended | null;
  activeSearchRadius: number;
  activeFilter: HelpServiceType | "all";
  mapView: boolean;
}
