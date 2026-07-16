"use client";

import { MetricsStudio } from "@/components/metrics/MetricsStudio";
import { SoftRoomLock } from "@/components/shell/SoftRoomLock";
import { useForgeStage } from "@/components/shell/StageProvider";
import { useShell } from "@/components/shell/ShellContext";

export default function MetricsPage() {
  const { currentBusiness } = useShell();
  const { isRoomUnlocked } = useForgeStage();
  const unlocked = isRoomUnlocked("monitor");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-1 text-xs uppercase tracking-widest text-text-muted">
          Monitor room
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Metrics</h1>
        <p className="mt-3 max-w-2xl text-sm text-text-muted">
          Instrument what matters before you automate. Track content pipeline
          health and channel signals (followers, engagement). Record samples
          manually now; Hermes collection jobs can fill these later.
        </p>
      </div>

      {!unlocked ? (
        <SoftRoomLock room="monitor" />
      ) : (
        <MetricsStudio businessId={currentBusiness?.id ?? null} />
      )}
    </main>
  );
}
