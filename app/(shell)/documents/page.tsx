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
        {currentBusiness && (
          <p className="mt-1 text-sm text-accent">in {currentBusiness.name}</p>
        )}
        <p className="mt-3 max-w-2xl text-sm text-text-muted">
          Durable business knowledge — basics, customers, market, strategy, and
          notes. Pin documents so Hermes uses them as context when mapping
          processes or helping you strategize. Open Hermes chat to talk through
          updates; edit markdown here when you want precise control.
        </p>
      </div>

      <DocumentsStudio
        businessId={currentBusiness?.id ?? null}
        businessName={currentBusiness?.name ?? null}
      />
    </main>
  );
}
