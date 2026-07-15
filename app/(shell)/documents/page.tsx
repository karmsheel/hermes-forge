"use client";

import { DocumentsStudio } from "@/components/documents/DocumentsStudio";
import { useShell } from "@/components/shell/ShellContext";

export default function DocumentsPage() {
  const { currentBusiness } = useShell();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-1 text-xs uppercase tracking-widest text-text-muted">
          Knowledge
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
      </div>

      <DocumentsStudio businessId={currentBusiness?.id ?? null} />
    </main>
  );
}
