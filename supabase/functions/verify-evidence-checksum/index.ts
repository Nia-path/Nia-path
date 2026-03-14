// supabase/functions/verify-evidence-checksum/index.ts
// Verifies stored evidence integrity by re-computing SHA-256 checksums
// Called by n8n after evidence upload, or on-demand for legal proceedings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  const { evidence_id } = await req.json();
  if (!evidence_id) {
    return new Response(JSON.stringify({ error: "evidence_id required" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch evidence record
  const { data: evidence, error } = await supabase
    .from("evidence")
    .select("id, storage_bucket, storage_path, checksum_sha256, file_size")
    .eq("id", evidence_id)
    .single();

  if (error || !evidence) {
    return new Response(JSON.stringify({ error: "Evidence not found" }), { status: 404 });
  }

  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(evidence.storage_bucket)
      .download(evidence.storage_path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: "File not found in storage", evidence_id }),
        { status: 404 }
      );
    }

    // Compute SHA-256 of file contents
    const buffer = await fileData.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedChecksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const isIntact = computedChecksum === evidence.checksum_sha256;

    // Update verification timestamp
    await supabase
      .from("evidence")
      .update({
        checksum_verified_at: new Date().toISOString(),
        is_tamper_evident: isIntact,
      })
      .eq("id", evidence_id);

    // If tampered, create audit log entry
    if (!isIntact) {
      await supabase.from("audit_log").insert({
        action: "INTEGRITY_FAILURE",
        resource_type: "evidence",
        resource_id: evidence_id,
        new_data: {
          expected_checksum: evidence.checksum_sha256,
          computed_checksum: computedChecksum,
          detected_at: new Date().toISOString(),
        },
      });
    }

    return new Response(
      JSON.stringify({
        evidence_id,
        is_intact: isIntact,
        expected_checksum: evidence.checksum_sha256,
        computed_checksum: computedChecksum,
        verified_at: new Date().toISOString(),
      }),
      {
        status: isIntact ? 200 : 409,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Verification failed", detail: (err as Error).message }),
      { status: 500 }
    );
  }
});
