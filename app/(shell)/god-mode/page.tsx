"use client";

import { useState } from "react";
import { GodModeCanvas } from "@/components/god-mode/GodModeCanvas";

export default function GodModePage() {
  const [stats, setStats] = useState({
    total: 0,
    withDiagrams: 0,
    businessName: null as string | null,
  });

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between bg-bg">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Overview</div>
          <h1 className="font-semibold text-sm text-text-strong">God Mode</h1>
          {stats.businessName && (
            <p className="text-xs text-text-muted mt-0.5">
              {stats.businessName}
              {stats.total > 0 && (
                <>
                  {" "}
                  · {stats.total} process{stats.total !== 1 ? "es" : ""}
                  {stats.withDiagrams > 0 && (
                    <>
                      {" "}
                      · {stats.withDiagrams} with diagram{stats.withDiagrams !== 1 ? "s" : ""}
                    </>
                  )}
                </>
              )}
            </p>
          )}
        </div>
      </header>

      <GodModeCanvas onStatsChange={setStats} />
    </div>
  );
}