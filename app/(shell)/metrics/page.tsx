"use client";

import { MetricsStudio } from "@/components/metrics/MetricsStudio";
import { useShell } from "@/components/shell/ShellContext";

export default function MetricsPage() {
  const { currentBusiness } = useShell();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-1 text-xs uppercase tracking-widest text-text-muted">
          Monitor
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Metrics</h1>
        {currentBusiness && (
          <p className="mt-1 text-sm text-accent">in {currentBusiness.name}</p>
        )}
        <p className="mt-3 max-w-2xl text-sm text-text-muted">
          Instrument what matters before you automate. Track content pipeline
          health and channel signals (followers, engagement). Record samples
          manually now; Hermes collection jobs can fill these later.
        </p>
      </div>

      <MetricsStudio businessId={currentBusiness?.id ?? null} />
    </main>
  );
}
