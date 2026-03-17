// src/lib/supabase/client.ts
// Browser-side Supabase client — safe to import in Client Components.
// Uses createBrowserClient which manages cookies automatically.
// Import this in hooks, event handlers, and client components.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Singleton pattern — one client per browser session
  if (client) return client;

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce", // More secure than implicit flow
      },
    }
  );

  return client;
}
