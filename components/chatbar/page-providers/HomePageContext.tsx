"use client";

import { useEffect, useMemo, useState } from "react";
import { useShell } from "@/components/shell/ShellContext";
import type { ProcessSummary } from "@/lib/types";
import { useRegisterPageContext } from "../useRegisterPageContext";

/**
 * Registers Home page selection/snapshot extras for hermes.forge.context.v1.
 */
export function HomePageContext() {
  const { currentBusiness } = useShell();
  const [recent, setRecent] = useState<{ name: string; status: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/processes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list: ProcessSummary[] = data.processes || [];
        setRecent(
          list.slice(0, 4).map((p) => ({
            name: p.name,
            status: p.status,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentBusiness?.id]);

  const registration = useMemo(() => {
    if (!currentBusiness) return null;
    const lines = [
      `Home surface for ${currentBusiness.name}`,
      recent.length
        ? `Recent strip: ${recent.map((p) => `${p.name} [${p.status}]`).join("; ")}`
        : "Recent strip: empty — start from a brief",
    ];
    return {
      selection: {
        type: "home",
        summary: recent.length
          ? `${recent.length} recent process(es) on Home`
          : "Home — no recent processes yet",
        details: { recent },
      },
      snapshotLines: lines,
    };
  }, [currentBusiness, recent]);

  useRegisterPageContext(registration);
  return null;
}
