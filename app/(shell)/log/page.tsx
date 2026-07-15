"use client";

import { BusinessLogFeed } from "@/components/log/BusinessLogFeed";

export default function BusinessLogPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
          Activity
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Business log</h1>
        <p className="text-sm text-text-muted mt-3 max-w-2xl">
          A chronological record of everything that has happened in this business —
          processes, automations, owner decisions, chat, and more.
        </p>
      </div>

      <BusinessLogFeed />
    </main>
  );
}