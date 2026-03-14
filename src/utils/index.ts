// src/utils/index.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { CaseCategory, EvidenceType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, pattern = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  domestic_violence: "Domestic Violence",
  sexual_harassment: "Sexual Harassment",
  workplace_discrimination: "Workplace Discrimination",
  property_rights: "Property Rights",
  child_custody: "Child Custody",
  financial_abuse: "Financial Abuse",
  other: "Other",
};

export const EVIDENCE_TYPE_ICONS: Record<EvidenceType, string> = {
  photo: "🖼️",
  video: "🎥",
  audio: "🎙️",
  document: "📄",
  screenshot: "📸",
  location: "📍",
};

export const CASE_CATEGORY_COLORS: Record<CaseCategory, string> = {
  domestic_violence: "bg-red-100 text-red-800",
  sexual_harassment: "bg-orange-100 text-orange-800",
  workplace_discrimination: "bg-yellow-100 text-yellow-800",
  property_rights: "bg-blue-100 text-blue-800",
  child_custody: "bg-purple-100 text-purple-800",
  financial_abuse: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-800",
};

export function generateChecksum(content: string): string {
  // Simple checksum for display — in production use Web Crypto API
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function isValidPhone(phone: string): boolean {
  return /^(\+254|0)[17]\d{8}$/.test(phone.replace(/\s/g, ""));
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2");
}

export async function getCurrentLocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
