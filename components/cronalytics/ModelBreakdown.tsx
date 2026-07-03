"use client";

import type { ModelsResponse } from "@/lib/cronalytics/types";
import { fmtCompact, fmtCost, fmtPct } from "./formatters";

export function ModelBreakdown({ models }: { models: ModelsResponse | null }) {
  if (!models) return null;
  const totalCost = models.models.reduce((s, m) => s + m.total_cost_usd, 0);
  if (models.models.length === 0) return null;

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight">By model</h2>
        <span className="text-xs text-text-soft">{models.models.length} models</span>
      </div>
      <ul className="space-y-2">
        {models.models.map((m) => {
          const pct = totalCost ? (m.total_cost_usd / totalCost) * 100 : 0;
          return (
            <li key={m.model}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-mono text-text truncate" title={m.model}>
                  {m.model}
                </span>
                <span className="font-mono tabular-nums">
                  {fmtCost(m.total_cost_usd)}{" "}
                  <span className="text-text-soft text-xs">
                    ({fmtPct(pct, 0)})
                  </span>
                </span>
              </div>
              <div className="text-xs text-text-soft">
                {m.runs.toLocaleString()} runs · {fmtCompact(m.total_input_tokens)} in / {fmtCompact(m.total_output_tokens)} out ·{" "}
                {fmtCost(m.avg_cost_per_run)}/run
              </div>
              <div className="mt-1 h-1 rounded-full bg-bg-muted overflow-hidden">
                <div className="h-full bg-accent/70 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
