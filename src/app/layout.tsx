// src/app/layout.tsx
// Root layout for the entire application.
// This must be a server component to set metadata.
// All children are wrapped in Providers (Redux, QueryClient, Auth, etc).

import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nia Path",
  description: "Secure evidence documentation and emergency support",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
