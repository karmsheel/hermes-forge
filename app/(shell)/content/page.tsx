"use client";

import { ContentStudio } from "@/components/content/ContentStudio";
import { SoftRoomLock } from "@/components/shell/SoftRoomLock";
import { useForgeStage } from "@/components/shell/StageProvider";
import { useShell } from "@/components/shell/ShellContext";

export default function ContentPage() {
  const { currentBusiness } = useShell();
  const { isRoomUnlocked } = useForgeStage();
  // Content lives under Monitor + Automate — same forged gate
  const unlocked = isRoomUnlocked("monitor");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-1 text-xs uppercase tracking-widest text-text-muted">
          Inventory
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Content</h1>
        <p className="mt-3 max-w-2xl text-sm text-text-muted">
          Pieces you ship — ideas, drafts, review, ready, shipped. Separate from
          Documents (business knowledge). In Automate, assign a Hermes agent and
          cron to draft on a schedule; review and mark status here.
        </p>
      </div>

      {!unlocked ? (
        <SoftRoomLock
          room="monitor"
          title="Content inventory opens after you forge a process"
        />
      ) : (
        <ContentStudio businessId={currentBusiness?.id ?? null} />
      )}
    </main>
  );
}
