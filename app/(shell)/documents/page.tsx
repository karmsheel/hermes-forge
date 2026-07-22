"use client";

import { DocumentsStudio } from "@/components/documents/DocumentsStudio";
import { useShell } from "@/components/shell/ShellContext";

export default function DocumentsPage() {
  const { currentBusiness } = useShell();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <DocumentsStudio businessId={currentBusiness?.id ?? null} />
    </main>
  );
}
