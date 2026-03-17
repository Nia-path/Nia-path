// src/lib/supabase/queries.ts
import type { Case, Evidence, HelpService, User } from "@/types";
import { createClient } from "./client";

const supabase = createClient();

// ─── Cases ──────────────────────────────────────────────────────────────────

export async function getCases(userId: string): Promise<Case[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("*, timeline_events(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCaseById(caseId: string): Promise<Case | null> {
  const { data, error } = await supabase
    .from("cases")
    .select("*, timeline_events(*)")
    .eq("id", caseId)
    .single();

  if (error) throw error;
  return data;
}

export async function createCase(
  payload: Pick<Case, "title" | "description" | "category" | "user_id" | "location">
): Promise<Case> {
  const { data, error } = await (supabase
    .from("cases") as any)
    .insert({ ...payload, status: "open", evidence_count: 0 })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCaseStatus(caseId: string, status: Case["status"]): Promise<void> {
  const { error } = await (supabase
    .from("cases") as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", caseId);

  if (error) throw error;
}

// ─── Evidence ──────────────────────────────────────────────────────────────

export async function getEvidenceByCase(caseId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select("*")
    .eq("case_id", caseId)
    .order("captured_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createEvidenceRecord(
  payload: Omit<Evidence, "id" | "uploaded_at">
): Promise<Evidence> {
  const { data, error } = await (supabase
    .from("evidence") as any)
    .insert({ ...payload, uploaded_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadEvidenceFile(
  userId: string,
  caseId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${caseId}/${Date.now()}.${ext}`;

  // Updated to use the correct private bucket defined in migrations
  const { error } = await supabase.storage
    .from("evidence-private")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  // Return the storage path instead of a public URL since the bucket is private
  return path;
}

// ─── Help Services ──────────────────────────────────────────────────────────

export async function getHelpServices(county?: string): Promise<HelpService[]> {
  let query = supabase.from("help_services").select("*").eq("verified", true);
  if (county) query = query.eq("county", county);

  const { data, error } = await query.order("name");
  if (error) throw error;
  return data ?? [];
}

// ─── User Profile ───────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<User>
): Promise<User> {
  const { data, error } = await (supabase
    .from("profiles") as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}