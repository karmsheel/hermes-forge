"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Download, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useShell } from '@/components/shell/ShellContext';

interface Process {
  id: string;
  name: string;
  description: string;
  department: string;
  automationScore: number;
  estimatedTimeSaved: number | null;
  repetition: number | null;
  businessValue: number | null;
  complexity: number | null;
  status: string;
  trigger?: string | null;
  manualSteps?: string | null;
  inputs?: string | null;
  outputs?: string | null;
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  teamSize: number | null;
  goals: string | null;
}

export default function DashboardPage() {
  const { currentBusiness } = useShell();
  const [business, setBusiness] = useState<Business | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/business');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();

      if (data && data.id) {
        setBusiness(data);
        setProcesses(data.processes || []);
      } else {
        setBusiness(null);
        setProcesses([]);
      }
    } catch (e) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, currentBusiness?.id]);

  const sortedProcesses = [...processes].sort((a, b) => b.automationScore - a.automationScore);

  const avgScore = processes.length > 0 
    ? Math.round(processes.reduce((sum, p) => sum + p.automationScore, 0) / processes.length) 
    : 0;

  const highPotential = processes.filter(p => p.automationScore >= 65).length;

  async function exportKnowledge() {
    const payload = {
      exportedAt: new Date().toISOString(),
      business,
      processes,
      note: "Hermes Forge Phase 1 — Business Knowledge Graph. Ready for future workflow generation."
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hermes-forge-${business?.name?.toLowerCase().replace(/\s+/g, '-') || 'business'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Business knowledge exported');
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Analytics</div>
          <h1 className="text-2xl font-semibold tracking-tight">Business Dashboard</h1>
          <span className="inline-block mt-2 text-xs pill pill-accent">Phase 1 — Discovery</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={async () => {
              await fetch("/api/seed", { method: "POST" });
              await loadData();
              toast.success("Demo business loaded");
            }}
            className="btn-secondary text-sm"
          >
            Load Demo Data
          </button>
          <button onClick={exportKnowledge} className="btn-primary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Knowledge Graph
          </button>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="text-center py-20 text-text-muted">Loading business model...</div>
        ) : !business ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-4">No active function. Select or create one to view the dashboard.</p>
            <Link href="/functions" className="btn-primary inline-flex">Go to Functions</Link>
          </div>
        ) : (
          <>
            {/* Business Summary */}
            <div className="mb-8">
              <div className="text-xs tracking-[1.5px] text-text-muted mb-1">YOUR BUSINESS</div>
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-4xl font-semibold tracking-tighter">{business.name}</h1>
                  {business.industry && <div className="text-green text-sm mt-1">{business.industry}</div>}
                </div>
                <div className="text-right text-sm text-text-muted">
                  {business.teamSize && `${business.teamSize} people`} • {business.goals && business.goals.slice(0, 70)}
                </div>
              </div>
              {business.description && (
                <p className="mt-3 text-text-muted max-w-3xl">{business.description}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
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
                  <div className="font-medium text-green">Discovery Complete • Ready for refinement</div>
                </div>
              </div>
            </div>

            {/* Processes Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-lg flex items-center gap-2">
                    <Target className="w-5 h-5" /> Processes &amp; Automation Opportunities
                  </div>
                  <div className="text-xs text-text-muted">Ranked by automation potential. All scores are recommendations only.</div>
                </div>
              </div>

              {processes.length === 0 ? (
                <div className="card p-8 text-center border-dashed">
                  <p className="text-text-muted">No processes extracted yet.</p>
                  <Link href="/interview" className="btn-primary mt-4 inline-flex">Go to Interview →</Link>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-panel text-left text-xs uppercase tracking-widest text-text-muted border-b border-border">
                        <th className="px-6 py-3 font-normal">Process</th>
                        <th className="px-4 py-3 font-normal">Department</th>
                        <th className="px-4 py-3 font-normal w-24">Score</th>
                        <th className="px-4 py-3 font-normal">Est. Time Saved</th>
                        <th className="px-6 py-3 font-normal">Key Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedProcesses.map((proc) => (
                        <tr key={proc.id} className="hover:bg-bg-panel/70">
                          <td className="px-6 py-4">
                            <div className="font-medium">{proc.name}</div>
                            <div className="text-xs text-text-muted line-clamp-2 mt-0.5">{proc.description}</div>
                          </td>
                          <td className="px-4 py-4 text-xs">
                            <span className="px-2.5 py-1 rounded-full bg-bg-muted text-text">{proc.department}</span>
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
                            {proc.estimatedTimeSaved ? `${proc.estimatedTimeSaved} hrs/wk` : '—'}
                          </td>
                          <td className="px-6 py-4 text-xs text-text-muted">
                            {proc.trigger && <div>Trigger: {proc.trigger}</div>}
                            {proc.manualSteps && <div className="line-clamp-1">Steps: {proc.manualSteps}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-8 text-xs text-text-muted border-t border-border pt-6">
              This is Phase 1 output. The business knowledge graph above is the core IP. 
              Future phases will use this model to generate executable workflows.
            </div>
          </>
        )}
      </div>
    </main>
  );
}