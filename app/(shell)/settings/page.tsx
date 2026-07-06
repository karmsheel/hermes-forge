"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";
import { resolveSettingsView } from "@/lib/settings-views";

function SettingsRouteRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSettings } = useShell();

  useEffect(() => {
    openSettings(resolveSettingsView(searchParams.get("tab")));

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/home");
  }, [openSettings, router, searchParams]);

  return null;
}

export default function SettingsRoutePage() {
  return (
    <Suspense fallback={null}>
      <SettingsRouteRedirect />
    </Suspense>
  );
}