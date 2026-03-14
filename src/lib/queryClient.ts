// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 min
      gcTime: 1000 * 60 * 30,        // 30 min
      retry: (failureCount, error: unknown) => {
        if (error instanceof Error && error.message.includes("401")) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const queryKeys = {
  cases: {
    all: (userId: string) => ["cases", userId] as const,
    detail: (caseId: string) => ["cases", "detail", caseId] as const,
  },
  evidence: {
    byCase: (caseId: string) => ["evidence", caseId] as const,
  },
  helpServices: {
    all: () => ["help_services"] as const,
    byCounty: (county: string) => ["help_services", county] as const,
  },
  profile: {
    me: (userId: string) => ["profile", userId] as const,
  },
};
