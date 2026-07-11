"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";

/**
 * Paths that remain reachable when the active business has no hired agent yet.
 * Everything else redirects to the forced first-hire screen.
 */
function isHireExemptPath(pathname: string): boolean {
  if (pathname.startsWith("/business-manager")) return true;
  if (pathname.startsWith("/personnel/hire")) return true;
  if (pathname.startsWith("/profile")) return true;
  if (pathname.startsWith("/settings")) return true;
  return false;
}

/**
 * After a business is created (or switched to one with zero hired agents),
 * force the user through /personnel/hire before the rest of the studio.
 */
export function HireRequiredGate() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { currentBusiness } = useShell();
  const businessId = currentBusiness?.id ?? null;

  useEffect(() => {
    if (!businessId) return;
    if (isHireExemptPath(pathname)) return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/personnel/agents");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const hiredCount = Array.isArray(data.hired)
          ? data.hired.length
          : Array.isArray(data.agents)
            ? data.agents.filter((a: { isHired?: boolean }) => a.isHired).length
            : 0;

        if (cancelled) return;

        if (hiredCount === 0) {
          router.replace("/personnel/hire?required=1");
        }
      } catch {
        /* non-fatal — don't trap the user if roster fails */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId, pathname, router]);

  return null;
}
