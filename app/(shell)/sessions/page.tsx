"use client";

import { SessionsStudio } from "@/components/sessions/SessionsStudio";

/**
 * Hermes runtime sessions manager (Foundation room).
 * Shell PageName provides the page label under the business picker.
 */
export default function SessionsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <p className="mb-6 max-w-2xl text-sm text-text-muted">
        View and manage Hermes Agent sessions on your API server — list, rename,
        fork, end, delete, inspect message history, and run a turn. These are
        Hermes runtime sessions (
        <code className="text-xs bg-bg-subtle px-1 rounded">/api/sessions</code>
        ), separate from Forge&apos;s own studio conversations.
      </p>

      <SessionsStudio />
    </main>
  );
}
