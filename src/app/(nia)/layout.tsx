// src/app/(nia)/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsNiaUnlocked } from "@/store/hooks";
import { NiaLayout } from "@/components/layout/NiaLayout";

export default function NiaRouteGroupLayout({ children }: { children: React.ReactNode }) {
  const isUnlocked = useIsNiaUnlocked();
  const router = useRouter();

  useEffect(() => {
    if (!isUnlocked) {
      router.replace("/");
    }
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  return <NiaLayout>{children}</NiaLayout>;
}
