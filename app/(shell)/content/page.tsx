"use client";

import { ContentStudio } from "@/components/content/ContentStudio";
import { useShell } from "@/components/shell/ShellContext";

/**
 * Content inventory — lives only in the Inventory room.
 * Route remains /content; room chrome is driven by forge-stage path inference.
 */
export default function ContentPage() {
  const { currentBusiness } = useShell();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="mb-8 max-w-2xl text-sm text-text-muted">
        Pieces you ship — ideas, drafts, review, ready, shipped. Separate from
        Documents (business knowledge). Agents in Automate can draft on a
        schedule; review and mark status here.
      </p>
      <ContentStudio businessId={currentBusiness?.id ?? null} />
    </main>
  );
}
