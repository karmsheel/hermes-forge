"use client";

import { Activity, AlertTriangle, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import type { AutomationRunHealthSummary } from "@/lib/types";

interface RunHealthCardProps {
  health: AutomationRunHealthSummary | null | undefined;
  loading?: boolean;
  compact?: boolean;
}

function outcomeIcon(health: AutomationRunHealthSummary) {
  if (health.runtimeStatus === "paused") {
    return <PauseCircle className="w-3.5 h-3.5 text-amber-400" />;
  }
  if (health.unhealthy || health.runtimeStatus === "failed" || health.lastOutcome === "failed") {
    return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
  }
  if (health.lastOutcome === "success") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  }
  return <Activity className="w-3.5 h-3.5 text-zinc-400" />;
}

function borderClass(health: AutomationRunHealthSummary): string {
  if (health.runtimeStatus === "paused") return "border-amber-500/25 bg-amber-500/5";
  if (health.unhealthy || health.runtimeStatus === "failed") {
    return "border-rose-500/25 bg-rose-500/5";
  }
  return "border-zinc-800 bg-zinc-900/40";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function RunHealthCard({ health, loading, compact }: RunHealthCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 text-[10px] text-zinc-500">
        Refreshing run health…
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 text-[10px] text-zinc-500">
        Connect Hermes and refresh to see last run status.
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`rounded-md border px-2 py-1.5 text-[10px] ${borderClass(health)}`}>
        <div className="flex items-center gap-1.5 text-zinc-300">
          {outcomeIcon(health)}
          <span className="truncate">{health.summary}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-2.5 space-y-2 ${borderClass(health)}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        <Activity className="w-3 h-3" /> Run health
      </div>
      <div className="flex items-start gap-2">
        {outcomeIcon(health)}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-200 leading-snug">{health.summary}</p>
          {health.lastError && (
            <p className="text-[10px] text-rose-300/90 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{health.lastError}</span>
            </p>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div>
          <dt className="text-zinc-600">Last run</dt>
          <dd className="text-zinc-400">{formatWhen(health.lastRunAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Outcome</dt>
          <dd className="text-zinc-400 capitalize">{health.lastOutcome}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Recent fails</dt>
          <dd className="text-zinc-400">
            {health.recentFailures}
            {health.consecutiveFailures > 1
              ? ` (${health.consecutiveFailures} in a row)`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Success rate</dt>
          <dd className="text-zinc-400">
            {health.successRate != null
              ? `${Math.round(health.successRate * 100)}%`
              : "—"}
            {health.recentRuns > 0 ? ` / ${health.recentRuns}` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
