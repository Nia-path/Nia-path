// src/types/index.ts

export type UserRole = "individual" | "organization_admin" | "legal_aid";

export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  is_stealth_unlocked: boolean;
  emergency_contacts: EmergencyContact[];
  created_at: string;
  updated_at: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

// ─── Cases ─────────────────────────────────────────────────────────────────

export type CaseStatus = "open" | "under_review" | "escalated" | "closed" | "archived";
export type CaseCategory =
  | "domestic_violence"
  | "sexual_harassment"
  | "workplace_discrimination"
  | "property_rights"
  | "child_custody"
  | "financial_abuse"
  | "other";

export interface Case {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: CaseCategory;
  status: CaseStatus;
  ai_summary?: string;
  ai_risk_level?: "low" | "medium" | "high" | "critical";
  location?: string;
  created_at: string;
  updated_at: string;
  evidence_count: number;
  timeline_events: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  case_id: string;
  title: string;
  description: string;
  event_date: string;
  event_type: "evidence_added" | "ai_analysis" | "report_generated" | "contact_made" | "manual";
  metadata?: Record<string, unknown>;
}

// ─── Evidence ──────────────────────────────────────────────────────────────

export type EvidenceType = "photo" | "video" | "audio" | "document" | "screenshot" | "location";

export interface Evidence {
  id: string;
  case_id: string;
  user_id: string;
  type: EvidenceType;
  file_name: string;
  file_url: string;
  thumbnail_url?: string;
  mime_type: string;
  file_size: number;
  description?: string;
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  captured_at: string;
  uploaded_at: string;
  is_encrypted: boolean;
  checksum: string;
}

// ─── Chat ──────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  actions?: ChatAction[];
  case_category?: CaseCategory;
  risk_assessment?: {
    level: "low" | "medium" | "high" | "critical";
    immediate_danger: boolean;
    recommended_steps: string[];
  };
}

export interface ChatAction {
  id: string;
  label: string;
  action: "create_case" | "call_emergency" | "find_shelter" | "upload_evidence" | "generate_report";
  variant: "primary" | "secondary" | "danger";
  icon?: string;
}

// ─── Help Center ────────────────────────────────────────────────────────────

export type HelpServiceType = "shelter" | "legal_aid" | "police_gender_desk" | "counseling" | "medical";

export interface HelpService {
  id: string;
  name: string;
  type: HelpServiceType;
  address: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  hours: string;
  description: string;
  county: string;
  lat: number;
  lng: number;
  is_24_hour: boolean;
  verified: boolean;
}

// ─── Emergency ──────────────────────────────────────────────────────────────

export interface EmergencySession {
  id: string;
  started_at: string;
  location?: GeolocationCoordinates;
  recordings: string[];
  photos: string[];
  alert_sent: boolean;
  contacts_notified: string[];
}

// ─── API ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isNiaUnlocked: boolean;
  sessionExpiresAt: string | null;
}

export interface CasesState {
  activeCase: Case | null;
  isCreating: boolean;
}

export interface EvidenceState {
  uploadQueue: UploadQueueItem[];
  isUploading: boolean;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  case_id: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export interface EmergencyState {
  isActive: boolean;
  session: EmergencySession | null;
  isRecording: boolean;
  hasLocation: boolean;
}
