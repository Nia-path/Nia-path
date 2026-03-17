// src/types/database.ts
// Type stubs for Supabase database.
// In production, generate this file with:
//   npx supabase gen types typescript --project-id your-project-ref > src/types/database.ts
//
// The types below cover the tables used by the auth system.
// Full table definitions live in the migration SQL files.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          display_name: string | null;
          phone: string | null;
          county: string | null;
          role: "individual" | "legal_aid" | "admin" | "moderator";
          language_preference: "en" | "sw";
          onboarding_complete: boolean;
          pin_hash: string | null;
          pin_salt: string | null;
          pin_set_at: string | null;
          emergency_contacts: Json;
          consent_terms_at: string | null;
          consent_privacy_at: string | null;
          is_verified: boolean;
          is_suspended: boolean;
          avatar_url: string | null;
          last_active_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          display_name?: string | null;
          phone?: string | null;
          county?: string | null;
          role?: "individual" | "legal_aid" | "admin" | "moderator";
          language_preference?: "en" | "sw";
          onboarding_complete?: boolean;
          emergency_contacts?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          display_name?: string | null;
          phone?: string | null;
          county?: string | null;
          language_preference?: "en" | "sw";
          onboarding_complete?: boolean;
          emergency_contacts?: Json;
          consent_terms_at?: string | null;
          consent_privacy_at?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      service_searches: {
        Row: {
          id: string;
          user_id: string;
          search_lat: number;
          search_lng: number;
          radius_km: number;
          service_type: string | null;
          results_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          search_lat: number;
          search_lng: number;
          radius_km: number;
          service_type?: string | null;
          results_count: number;
          created_at?: string;
        };
        Update: {
          search_lat?: number;
          search_lng?: number;
          radius_km?: number;
          service_type?: string | null;
          results_count?: number;
        };
      };
    };
    Functions: {
      get_nearby_help_services: {
        Args: {
          user_lat: number;
          user_lng: number;
          radius_km?: number;
          service_type?: string | null;
          emergency_only?: boolean;
          result_limit?: number;
        };
        Returns: {
          id: string;
          name: string;
          address: string;
          phone: string | null;
          website: string | null;
          latitude: number;
          longitude: number;
          distance_km: number;
          service_type: string;
          is_emergency: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience type for a profile row
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
