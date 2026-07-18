"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOverlordExemptPath } from "@/lib/overlord/paths";

/**
 * Until the user sets a Forge Overlord, force /setup/overlord.
 * Exempt: setup, settings, profile. Business Manager is NOT exempt.
 */
export function OverlordRequiredGate() {
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    if (isOverlordExemptPath(pathname)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/overlord");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (!data.overlord?.profileKey) {
          router.replace("/setup/overlord");
        }
      } catch {
        /* non-fatal */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
