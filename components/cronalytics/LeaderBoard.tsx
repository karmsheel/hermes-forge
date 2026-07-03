"use client";

import type { JobAggregate } from "@/lib/cronalytics/types";
import { fmtCompact, fmtCost, fmtDuration, fmtTime, paceColor, paceLabel } from "./formatters";

export function LeaderBoard({
  jobs,
  onSelect,
}: {
  jobs: JobAggregate[];
  onSelect: (job: JobAggregate) => void;
}) {
  const top = [...jobs].sort((a, b) => b.total_cost_usd - a.total_cost_usd).slice(0, 5);
  if (top.length === 0) return null;

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Top jobs by cost</h2>
        <span className="text-xs text-text-soft">{summaryLine(top)}</span>
      </div>
      <ol className="space-y-2">
        {top.map((job, i) => {
          const pct = top[0].total_cost_usd
            ? (job.total_cost_usd / top[0].total_cost_usd) * 100
            : 0;
          return (
            <li key={job.job_id}>
              <button
                type="button"
                onClick={() => onSelect(job)}
                className="w-full text-left group flex items-center gap-3 hover:bg-bg-muted/30 -mx-2 px-2 py-1.5 rounded-md transition"
              >
                <span className="text-xs font-mono text-text-soft w-5 text-right">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-text truncate" title={job.name}>
                      {job.name}
                    </span>
                    <span className="text-sm font-mono shrink-0">
                      {fmtCost(job.total_cost_usd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-soft mt-0.5">
                    <span>{job.runs.toLocaleString()} runs</span>
                    <span>·</span>
                    <span className={paceColor(job.pace_status)}>
                      {paceLabel(job.pace_status)}
                      {job.pace_drift_pct != null && Math.abs(job.pace_drift_pct) > 1
                        ? ` (${job.pace_drift_pct > 0 ? "+" : ""}${job.pace_drift_pct.toFixed(0)}%)`
                        : ""}
                    </span>
                    <span>·</span>
                    <span>last {fmtTime(job.last_run_at)}</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-bg-muted overflow-hidden">
                    <div
                      className="h-full bg-accent/70 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function summaryLine(jobs: JobAggregate[]): string {
  const total = jobs.reduce((s, j) => s + j.total_cost_usd, 0);
  const tokens = jobs.reduce(
    (s, j) => s + j.total_input_tokens + j.total_output_tokens,
    0,
  );
  return `${fmtCompact(tokens)} tok · ${fmtDuration(
    jobs.reduce((s, j) => s + (j.avg_duration_seconds ?? 0) * j.runs, 0) /
      Math.max(1, jobs.reduce((s, j) => s + j.runs, 0)),
  )} avg`;
}
