// src/components/Providers.tsx
"use client";

import { Provider as ReduxProvider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import { store } from "@/store";
import { queryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-center"
          gutter={8}
          containerStyle={{ top: 64 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1e1710",
              color: "#fdf8f0",
              fontSize: "14px",
              borderRadius: "12px",
              maxWidth: "340px",
            },
            success: {
              iconTheme: { primary: "#c47f22", secondary: "#fdf8f0" },
            },
            error: {
              iconTheme: { primary: "#e63946", secondary: "#fdf8f0" },
            },
          }}
        />
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ReduxProvider>
  );
}
