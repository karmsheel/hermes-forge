"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GodModeCanvas,
  type GodModeStats,
} from "@/components/god-mode/GodModeCanvas";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";

export default function GodModePage() {
  const router = useRouter();
  const { hydrated, showGodModePage } = useDeveloperSettings();
  const [stats, setStats] = useState<GodModeStats>({
    total: 0,
    withDiagrams: 0,
    viewMode: "compact",
  });

  useEffect(() => {
    if (hydrated && !showGodModePage) {
      router.replace("/home");
    }
  }, [hydrated, showGodModePage, router]);

  if (!hydrated || !showGodModePage) {
    return null;
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between bg-bg">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Overview
          </div>
          <h1 className="font-semibold text-sm text-text-strong">God Mode</h1>
          {stats.total > 0 && (
            <p className="text-xs text-text-muted mt-0.5">
              {stats.total} process{stats.total !== 1 ? "es" : ""}
              {stats.viewMode === "compact" ? (
                <> · plant shapes</>
              ) : stats.withDiagrams > 0 ? (
                <>
                  {" "}
                  · {stats.withDiagrams} with diagram
                  {stats.withDiagrams !== 1 ? "s" : ""}
                </>
              ) : null}
            </p>
          )}
        </div>
      </header>

      <GodModeCanvas onStatsChange={setStats} />
    </div>
  );
}
