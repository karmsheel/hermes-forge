"use client";

import { BusinessLogFeed } from "@/components/log/BusinessLogFeed";

export default function BusinessLogPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10 w-full">
      <p className="mb-8 max-w-2xl text-sm text-text-muted">
        A chronological record of everything that has happened in this business —
        processes, automations, owner decisions, chat, and more.
      </p>

      <BusinessLogFeed />
    </main>
  );
}