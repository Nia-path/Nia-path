// src/app/api/auth/callback/route.ts
// Handles the OAuth/magic link/email confirmation redirect from Supabase.
// Supabase sends the user here after they verify their email.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle auth errors from Supabase (e.g. expired link)
  if (error) {
    const url = new URL(`${origin}/auth/sign-in`);
    url.searchParams.set(
      "error",
      errorDescription ?? "Authentication failed. Please try again."
    );
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Ensure the redirect target is safe (no open redirect)
      const safeNext = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(new URL(safeNext, origin));
    }

    // Exchange failed
    const url = new URL(`${origin}/auth/sign-in`);
    url.searchParams.set("error", "Session could not be established. Please try again.");
    return NextResponse.redirect(url);
  }

  // No code — redirect to sign-in
  return NextResponse.redirect(new URL("/auth/sign-in", origin));
}
