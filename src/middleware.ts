// src/middleware.ts
// Protects all Nia platform routes behind Supabase Auth.
// Runs at the Edge — before any page or API handler.

import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/cases",
  "/evidence",
  "/chat",
  "/emergency",
  "/help",
  "/timeline",
  "/profile",
];

// Routes that authenticated users should not access (redirect to dashboard)
const AUTH_ONLY_PATHS = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/reset-password",
];

// API routes that handle auth callbacks — always allow through
const ALWAYS_ALLOW = [
  "/api/auth/callback",
  "/api/auth/confirm",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: static assets, PWA files, public API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/screenshots") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    ALWAYS_ALLOW.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createMiddlewareClient(req, res);

  // Refresh session if expired — this mutates `res` cookies
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = !!session;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthPage = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !isAuthenticated) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth/sign-in";
    // Preserve the intended destination
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && isAuthenticated) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Security headers on all responses
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self)"
  );
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co https://api.openai.com",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ")
  );

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
