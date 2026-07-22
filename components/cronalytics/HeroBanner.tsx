"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { fmtSyncAge } from "./formatters";
import type { HealthResponse } from "@/lib/cronalytics/types";

export function HeroBanner({
  onSync,
  syncing,
  error,
  windowLabel,
  totalRuns,
  successRate,
}: {
  onSync: () => void;
  syncing: boolean;
  error: string | null;
  windowLabel: string;
  totalRuns: number;
  successRate: number | null;
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/cronalytics/health");
      if (res.ok) {
        const data = (await res.json()) as HealthResponse;
        setHealth(data);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const syncInfo = health?.sync;
  const syncAge = syncInfo ? fmtSyncAge(syncInfo.last_sync) : "never";
  const hermesOk = health?.hermes_reachable ?? false;

  return (
    <div className="card p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted max-w-2xl">
            Cost and operational observability for your scheduled cron jobs. Reads sessions from
            Hermes&apos;s state.db and attributes token use + estimated cost to each run.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[200px]">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="btn-primary"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync from Hermes
              </>
            )}
          </button>
          <div className="text-xs text-text-soft text-right">
            Last sync: <span className="text-text-muted">{syncAge}</span>
            {syncInfo && (
              <span className="block">
                {syncInfo.rows_synced.toLocaleString()} total runs
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <StatusPill
          ok={hermesOk}
          label={hermesOk ? "Hermes reachable" : "Hermes not reachable"}
          detail={
            hermesOk
              ? health?.hermes_home ?? ""
              : health?.hermes_error ?? "Check HERMES_HOME"
          }
        />
        <StatusPill
          ok={(health?.cron_run_count ?? 0) > 0}
          label="Fact DB"
          detail={
            health
              ? `${health.cron_run_count.toLocaleString()} runs in ${health.fact_db_path
                  .split(/[/\\]/)
                  .pop()}`
              : "loading"
          }
        />
        <StatusPill
          ok={true}
          label={windowLabel}
          detail={`${totalRuns.toLocaleString()} runs · ${successRate != null ? `${(successRate * 100).toFixed(1)}% success` : "—"}`}
        />
      </div>

      {error && (
        <div className="mt-4 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function StatusPill({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 bg-bg-muted/30 border border-border rounded-lg px-3 py-2">
      <span
        className={`mt-1 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
          ok ? "bg-emerald-400" : "bg-amber-400"
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="font-medium text-text">{label}</div>
        <div className="text-text-soft truncate" title={detail}>
          {detail}
        </div>
      </div>
    </div>
  );
}
