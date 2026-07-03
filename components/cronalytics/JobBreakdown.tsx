"use client";

import { useState } from "react";
import type { JobAggregate } from "@/lib/cronalytics/types";
import { fmtCompact, fmtCost, fmtDuration, fmtTime, paceColor, paceLabel } from "./formatters";
import { SparkLine } from "./SparkLine";

type SortKey = "total_cost_usd" | "runs" | "avg_duration_seconds" | "last_run_at" | "name";

export function JobBreakdown({
  jobs,
  onSelect,
}: {
  jobs: JobAggregate[];
  onSelect: (job: JobAggregate) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "total_cost_usd",
    dir: "desc",
  });

  const sorted = [...jobs].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sort.dir === "asc" ? cmp : -cmp;
  });

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  function header(label: string, key: SortKey, align: "left" | "right" = "right") {
    const active = sort.key === key;
    return (
      <th
        className={`px-3 py-2 text-xs font-mono uppercase tracking-wider text-text-soft cursor-pointer select-none ${
          align === "right" ? "text-right" : "text-left"
        }`}
        onClick={() => toggle(key)}
      >
        <span className={active ? "text-text" : ""}>
          {label}
          {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
        </span>
      </th>
    );
  }

  return (
    <div className="card overflow-hidden mb-6">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="text-sm font-semibold tracking-tight">All jobs</h2>
        <span className="text-xs text-text-soft">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              {header("Name", "name", "left")}
              {header("Runs", "runs")}
              <th className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-text-soft text-right">
                Success
              </th>
              {header("Cost", "total_cost_usd")}
              {header("Avg dur.", "avg_duration_seconds")}
              <th className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-text-soft text-right">
                Pace
              </th>
              {header("Last run", "last_run_at")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((job) => (
              <tr
                key={job.job_id}
                onClick={() => onSelect(job)}
                className="border-b border-border/40 hover:bg-bg-muted/30 cursor-pointer"
              >
                <td className="px-3 py-2 max-w-[300px]">
                  <div className="font-medium text-text truncate" title={job.name}>
                    {job.name}
                  </div>
                  <div className="text-xs text-text-soft font-mono truncate" title={job.job_id}>
                    {job.schedule_display ?? job.job_id}
                    {job.no_agent && <span className="ml-2 pill-amber">no-agent</span>}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{job.runs.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {job.success_rate != null
                    ? `${(job.success_rate * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtCost(job.total_cost_usd)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                  {fmtDuration(job.avg_duration_seconds)}
                </td>
                <td className={`px-3 py-2 text-right text-xs ${paceColor(job.pace_status)}`}>
                  {paceLabel(job.pace_status)}
                  {job.pace_drift_pct != null && Math.abs(job.pace_drift_pct) > 1 ? (
                    <span className="ml-1 text-text-soft">
                      {job.pace_drift_pct > 0 ? "+" : ""}
                      {job.pace_drift_pct.toFixed(0)}%
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right text-text-muted">
                  {fmtTime(job.last_run_at)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-text-soft">
                  No jobs in this window. Run a sync to populate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompactCostSpark({ jobs }: { jobs: JobAggregate[] }) {
  const values = jobs.map((j) => j.total_cost_usd);
  return <SparkLine values={values} width={120} height={20} />;
}
