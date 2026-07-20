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
      <div className="mb-8">
        <div className="mb-1 text-xs uppercase tracking-widest text-text-muted">
          Inventory
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Content</h1>
        <p className="mt-3 max-w-2xl text-sm text-text-muted">
          Pieces you ship — ideas, drafts, review, ready, shipped. Separate from
          Documents (business knowledge). Agents in Automate can draft on a
          schedule; review and mark status here.
        </p>
      </div>

      <ContentStudio businessId={currentBusiness?.id ?? null} />
    </main>
  );
}
