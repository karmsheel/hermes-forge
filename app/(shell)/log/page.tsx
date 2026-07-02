"use client";

import { BusinessLogFeed } from "@/components/log/BusinessLogFeed";
import { useShell } from "@/components/shell/ShellContext";

export default function BusinessLogPage() {
  const { currentBusiness } = useShell();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
          Activity
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Business log</h1>
        {currentBusiness && (
          <p className="text-sm text-accent mt-1">in {currentBusiness.name}</p>
        )}
        <p className="text-sm text-text-muted mt-3 max-w-2xl">
          A chronological record of everything that has happened in this business —
          processes, automations, chat, and more.
        </p>
      </div>

      <BusinessLogFeed />
    </main>
  );
}