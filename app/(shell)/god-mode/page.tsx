"use client";

import { useState } from "react";
import {
  GodModeCanvas,
  type GodModeStats,
} from "@/components/god-mode/GodModeCanvas";
import { SoftRoomLock } from "@/components/shell/SoftRoomLock";
import { useForgeStage } from "@/components/shell/StageProvider";

/**
 * Map room primary surface — plant PFD (promoted from dev-gated God Mode).
 * Route stays /god-mode for compatibility; chrome labels it Plant / Map.
 */
export default function GodModePage() {
  const { isRoomUnlocked } = useForgeStage();
  const [stats, setStats] = useState<GodModeStats>({
    total: 0,
    withDiagrams: 0,
    viewMode: "compact",
  });

  const mapReady = isRoomUnlocked("map");

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between bg-bg">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Map room
          </div>
          <h1 className="font-semibold text-sm text-text-strong">Plant</h1>
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

      {!mapReady ? (
        <div className="p-6">
          <SoftRoomLock
            room="map"
            title="Map fills as processes appear"
            description="Talk with Overlord in Foundation to seed draft process shapes. The plant map soft-unlocks when the first process exists."
          />
        </div>
      ) : (
        <GodModeCanvas onStatsChange={setStats} />
      )}
    </div>
  );
}
