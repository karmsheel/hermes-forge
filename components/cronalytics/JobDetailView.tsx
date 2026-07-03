"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { JobAggregate } from "@/lib/cronalytics/types";
import { fmtCost, fmtDuration, fmtTime, paceColor, paceLabel } from "./formatters";
import { SparkLine } from "./SparkLine";

interface RunRow {
  session_id: string;
  run_time: number;
  ended_at: number | null;
  duration_seconds: number | null;
  model: string | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  success: number | null;
  end_reason: string | null;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

export function JobDetailView({
  job,
  days,
  open,
  onClose,
}: {
  job: JobAggregate | null;
  days: number;
  open: boolean;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !job) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/cronalytics/jobs/${job.job_id}/runs?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { runs: RunRow[] };
        if (!cancelled) setRuns(data.runs ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load runs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, days, open]);

  if (!job) return null;

  return (
    <Modal open={open} onClose={onClose} title={job.name} size="xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
        <Pill label="Runs" value={job.runs.toLocaleString()} />
        <Pill label="Success" value={job.success_rate != null ? `${(job.success_rate * 100).toFixed(0)}%` : "—"} />
        <Pill label="Cost" value={fmtCost(job.total_cost_usd)} />
        <Pill
          label="Pace"
          value={
            <span className={paceColor(job.pace_status)}>
              {paceLabel(job.pace_status)}
            </span>
          }
        />
      </div>

      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-text-soft font-mono mb-2">
          Cost over time
        </div>
        <div className="card p-3 flex items-center gap-4">
          <SparkLine
            values={runs?.map((r) => r.estimated_cost_usd ?? r.actual_cost_usd) ?? []}
            width={400}
            height={48}
            ariaLabel="cost per run, newest on the right"
          />
          <div className="text-xs text-text-soft">
            Each tick = one run. Newest on the right.
          </div>
        </div>
      </div>

      <div className="text-xs uppercase tracking-wider text-text-soft font-mono mb-2">
        Individual runs
      </div>
      {loading && <div className="text-text-muted text-sm">Loading…</div>}
      {error && <div className="text-rose-400 text-sm">{error}</div>}
      {runs && runs.length === 0 && (
        <div className="text-text-muted text-sm">No runs in this window.</div>
      )}
      {runs && runs.length > 0 && (
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-muted/50">
              <tr className="text-text-soft">
                <th className="text-left px-2 py-1">When</th>
                <th className="text-right px-2 py-1">Dur.</th>
                <th className="text-right px-2 py-1">Cost</th>
                <th className="text-right px-2 py-1">In / Out tok</th>
                <th className="text-left px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.session_id} className="border-t border-border/30">
                  <td className="px-2 py-1.5">{fmtTime(r.run_time)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtDuration(r.duration_seconds)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtCost(r.estimated_cost_usd ?? r.actual_cost_usd)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                    {r.input_tokens.toLocaleString()} / {r.output_tokens.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.success === 1 ? (
                      <span className="text-emerald-400">ok</span>
                    ) : r.success === 0 ? (
                      <span className="text-rose-400" title={r.end_reason ?? ""}>
                        {r.end_reason ?? "failed"}
                      </span>
                    ) : (
                      <span className="text-text-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function Pill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-bg-muted/30 border border-border rounded-lg px-3 py-2">
      <div className="text-text-soft text-[0.65rem] uppercase tracking-wider font-mono">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
