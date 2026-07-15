"use client";

import Link from "next/link";
import { Download, RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";

export interface AnalyticsProcess {
  id: string;
  name: string;
  description: string;
  department: string;
  automationScore: number;
  estimatedTimeSaved: number | null;
  trigger?: string | null;
  manualSteps?: string | null;
  status?: string | null;
}

export interface AnalyticsBusiness {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  teamSize: number | null;
  goals: string | null;
}

interface BusinessAnalyticsSectionProps {
  business: AnalyticsBusiness;
  processes: AnalyticsProcess[];
  onRefresh: () => void;
}

export function BusinessAnalyticsSection({
  business,
  processes,
  onRefresh,
}: BusinessAnalyticsSectionProps) {
  const sortedProcesses = [...processes].sort((a, b) => b.automationScore - a.automationScore);
  const avgScore =
    processes.length > 0
      ? Math.round(processes.reduce((sum, p) => sum + p.automationScore, 0) / processes.length)
      : 0;
  const highPotential = processes.filter((p) => p.automationScore >= 65).length;

  async function exportKnowledge() {
    const payload = {
      exportedAt: new Date().toISOString(),
      business,
      processes,
      note: "Hermes Forge — Business Knowledge Graph export.",
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hermes-forge-${business.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Business knowledge exported");
  }

  return (
    <section className="function-analytics">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Analysis</div>
          <h2 className="text-xl font-semibold tracking-tight">Automation opportunities</h2>
          <p className="text-xs text-text-muted mt-1">
            Process scores and time-saved estimates across {business.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onRefresh} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/seed", { method: "POST" });
              onRefresh();
              toast.success("Demo business loaded");
            }}
            className="btn-secondary text-sm"
          >
            Load demo data
          </button>
          <button
            type="button"
            onClick={() => void exportKnowledge()}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export knowledge graph
          </button>
        </div>
      </div>

      {(business.industry || business.description || business.teamSize || business.goals) && (
        <div className="mb-6 text-sm text-text-muted">
          {business.industry && (
            <span className="text-green mr-3">{business.industry}</span>
          )}
          {business.teamSize && <span>{business.teamSize} people</span>}
          {business.description && (
            <p className="mt-2 max-w-3xl">{business.description}</p>
          )}
          {business.goals && !business.description && (
            <p className="mt-2 max-w-3xl line-clamp-2">{business.goals}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="text-xs text-text-muted">PROCESSES MAPPED</div>
          <div className="text-4xl font-semibold mt-1 tabular-nums">{processes.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-text-muted">AVG AUTOMATION SCORE</div>
          <div className="text-4xl font-semibold mt-1 tabular-nums text-green">{avgScore}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-text-muted">HIGH POTENTIAL (≥65)</div>
          <div className="text-4xl font-semibold mt-1 tabular-nums text-green">{highPotential}</div>
        </div>
        <div className="card p-5 flex items-center">
          <div>
            <div className="text-xs text-text-muted">STATUS</div>
            <div className="font-medium text-green text-sm">
              {processes.length > 0 ? "Ready for refinement" : "No processes yet"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-lg flex items-center gap-2">
              <Target className="w-5 h-5" />
              Processes ranked by automation potential
            </div>
            <div className="text-xs text-text-muted">
              Scores are recommendations only.
            </div>
          </div>
        </div>

        {processes.length === 0 ? (
          <div className="card p-8 text-center border-dashed">
            <p className="text-text-muted">No processes mapped yet.</p>
            <Link href="/home" className="btn-primary mt-4 inline-flex">
              Map a process from Home →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-panel text-left text-xs uppercase tracking-widest text-text-muted border-b border-border">
                  <th className="px-6 py-3 font-normal">Process</th>
                  <th className="px-4 py-3 font-normal">Function</th>
                  <th className="px-4 py-3 font-normal w-24">Score</th>
                  <th className="px-4 py-3 font-normal">Est. time saved</th>
                  <th className="px-6 py-3 font-normal">Key details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedProcesses.map((proc) => (
                  <tr key={proc.id} className="hover:bg-bg-panel/70">
                    <td className="px-6 py-4">
                      <div className="font-medium">{proc.name}</div>
                      <div className="text-xs text-text-muted line-clamp-2 mt-0.5">
                        {proc.description}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-bg-muted text-text">
                        {proc.department}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 text-right font-mono tabular-nums text-lg font-medium text-green">
                          {proc.automationScore}
                        </div>
                        <div className="flex-1 score-bar max-w-[90px]">
                          <div
                            className="score-fill"
                            style={{ width: `${proc.automationScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-text tabular-nums">
                      {proc.estimatedTimeSaved ? `${proc.estimatedTimeSaved} hrs/wk` : "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-text-muted">
                      {proc.trigger && <div>Trigger: {proc.trigger}</div>}
                      {proc.manualSteps && (
                        <div className="line-clamp-1">Steps: {proc.manualSteps}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}