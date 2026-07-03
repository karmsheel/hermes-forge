"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { SummaryResponse } from "@/lib/cronalytics/types";
import { fmtCompact, fmtCost, fmtDuration, fmtPct, fmtTokens } from "./formatters";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  pctChange?: number | null;
}

function StatCard({ label, value, hint, pctChange }: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-text-soft font-mono mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="flex items-center gap-2 mt-1 text-xs">
        {pctChange != null && Number.isFinite(pctChange) && (
          <span
            className={`inline-flex items-center gap-0.5 ${
              pctChange > 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {pctChange > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {fmtPct(pctChange)}
          </span>
        )}
        {hint && <span className="text-text-soft">{hint}</span>}
      </div>
    </div>
  );
}

export function SummaryBoard({ summary }: { summary: SummaryResponse | null }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 h-24 animate-pulse bg-bg-muted/30" />
        ))}
      </div>
    );
  }
  const sr = summary.success_rate;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
      <StatCard
        label="Runs"
        value={summary.total_runs.toLocaleString()}
        pctChange={summary.run_pct_change}
        hint={`${summary.total_successes.toLocaleString()} succeeded`}
      />
      <StatCard
        label="Success rate"
        value={sr != null ? `${(sr * 100).toFixed(1)}%` : "—"}
        hint={
          summary.total_failures > 0
            ? `${summary.total_failures.toLocaleString()} failed`
            : "no failures"
        }
      />
      <StatCard
        label="Est. cost"
        value={fmtCost(summary.tot_estimated_cost_usd)}
        pctChange={summary.cost_pct_change}
        hint="vs previous period"
      />
      <StatCard
        label="Input tokens"
        value={fmtTokens(summary.tot_input_tokens)}
        hint={`+ ${fmtTokens(summary.tot_cache_read_tokens)} cached`}
      />
      <StatCard
        label="Output tokens"
        value={fmtTokens(summary.tot_output_tokens)}
        hint={`+ ${fmtTokens(summary.tot_reasoning_tokens)} reasoning`}
      />
      <StatCard
        label="Avg duration"
        value={fmtDuration(summary.avg_duration_seconds)}
        hint={summary.median_duration_seconds ? `median ${fmtDuration(summary.median_duration_seconds)}` : ""}
      />
    </div>
  );
}
