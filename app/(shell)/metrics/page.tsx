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
      <p className="mb-8 max-w-2xl text-sm text-text-muted">
        Instrument what matters before you automate. Track content pipeline
        health and channel signals (followers, engagement). Record samples
        manually now; Hermes collection jobs can fill these later.
      </p>

      {!unlocked ? (
        <SoftRoomLock room="monitor" />
      ) : (
        <MetricsStudio businessId={currentBusiness?.id ?? null} />
      )}
    </main>
  );
}
