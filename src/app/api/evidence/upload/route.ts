// src/app/api/evidence/upload/route.ts
// Feature 4: Updated evidence upload with full device & verification metadata

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caseId = formData.get("case_id") as string;
    const evidenceType = formData.get("evidence_type") as string;
    const description = formData.get("description") as string | null;
    const locationLat = formData.get("location_lat");
    const locationLng = formData.get("location_lng");
    const clientChecksum = formData.get("checksum_sha256") as string | null;
    const deviceMetaRaw = formData.get("device_metadata") as string | null;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > 52428800) return NextResponse.json({ error: "File too large" }, { status: 413 });

    const ALLOWED_MIMES = [
      "image/jpeg","image/png","image/webp","image/gif","image/heic",
      "video/mp4","video/webm","video/quicktime",
      "audio/mpeg","audio/wav","audio/webm","audio/mp4",
      "application/pdf","text/plain",
    ];
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Parse device metadata safely
    let deviceMeta: Record<string, string> = {};
    if (deviceMetaRaw) {
      try { deviceMeta = JSON.parse(deviceMetaRaw); } catch { /* ignore */ }
    }

    // Hash client IP and user agent for privacy-preserving audit
    const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const ipHash = createHash("sha256").update(clientIp).digest("hex");
    const uaHash = createHash("sha256").update(userAgent).digest("hex");

    // Read file bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Server-side checksum verification
    const serverChecksum = createHash("sha256").update(buffer).digest("hex");
    const md5Checksum = createHash("md5").update(buffer).digest("hex");
    const checksumMatch = !clientChecksum || clientChecksum === serverChecksum;

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() ?? "bin";
    const fileId = uuidv4();
    const storagePath = `${user.id}/${caseId}/${fileId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("evidence-private")
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    // Create evidence record with full metadata
    const { data: evidence, error: dbErr } = await supabase
      .from("evidence")
      .insert({
        id: fileId,
        case_id: caseId,
        user_id: user.id,
        type: evidenceType,
        file_name: file.name,
        storage_bucket: "evidence-private",
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        description: description ?? null,
        location_lat: locationLat ? parseFloat(locationLat as string) : null,
        location_lng: locationLng ? parseFloat(locationLng as string) : null,
        captured_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        // Checksum + verification
        checksum_sha256: serverChecksum,
        checksum_md5: md5Checksum,
        checksum_verified: checksumMatch,
        verification_status: checksumMatch ? "pending" : "tampered",
        // Device metadata
        device_platform: deviceMeta.platform ?? null,
        device_model: deviceMeta.model ?? null,
        device_os_version: deviceMeta.os_version ?? null,
        app_version: deviceMeta.app_version ?? null,
        network_type: deviceMeta.network_type ?? null,
        upload_ip_hash: ipHash,
        user_agent_hash: uaHash,
        is_tamper_evident: true,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Log access
    await supabase.from("evidence_access_log").insert({
      evidence_id: fileId,
      accessed_by: user.id,
      access_type: "view",
      context: "initial_upload",
    });

    return NextResponse.json(
      { success: true, evidence, checksum_match: checksumMatch },
      { status: 201 }
    );
  } catch (err) {
    console.error("[evidence/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
