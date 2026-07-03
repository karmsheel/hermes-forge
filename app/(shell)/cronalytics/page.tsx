"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DaySelector } from "@/components/cronalytics/DaySelector";
import { OutcomeToggle } from "@/components/cronalytics/OutcomeToggle";
import { ModeToggle } from "@/components/cronalytics/ModeToggle";
import { HeroBanner } from "@/components/cronalytics/HeroBanner";
import { SummaryBoard } from "@/components/cronalytics/SummaryBoard";
import { LeaderBoard } from "@/components/cronalytics/LeaderBoard";
import { JobBreakdown } from "@/components/cronalytics/JobBreakdown";
import { ModelBreakdown } from "@/components/cronalytics/ModelBreakdown";
import { JobDetailView } from "@/components/cronalytics/JobDetailView";
import type {
  CommonFilters,
  JobAggregate,
  ModelsResponse,
  OutcomeFilter,
  ModeFilter,
  SummaryResponse,
} from "@/lib/cronalytics/types";

type JobsResponse = { jobs: JobAggregate[] };

export default function CronalyticsPage() {
  const [filters, setFilters] = useState<CommonFilters>({ days: 30, outcome: "all", mode: "all" });
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [jobs, setJobs] = useState<JobAggregate[]>([]);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobAggregate | null>(null);

  const query = `days=${filters.days}&outcome=${filters.outcome}&mode=${filters.mode}`;

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const [s, j, m] = await Promise.all([
          fetch(`/api/cronalytics/summary?${query}`).then((r) => r.json()),
          fetch(`/api/cronalytics/jobs?${query}`).then((r) => r.json()),
          fetch(`/api/cronalytics/models?${query}`).then((r) => r.json()),
        ]);
        setSummary(s as SummaryResponse);
        setJobs(((j as JobsResponse).jobs ?? []) as JobAggregate[]);
        setModels(m as ModelsResponse);
      } catch (e) {
        toast.error("Failed to load cronalytics data");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.days, filters.outcome, filters.mode],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const onSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/cronalytics/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Sync failed");
      }
      const inserted = data?.result?.inserted ?? 0;
      toast.success(
        inserted > 0
          ? `Synced ${inserted.toLocaleString()} new run${inserted === 1 ? "" : "s"}`
          : "Already up to date",
      );
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncError(msg);
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }, [syncing, load]);

  const handleDaysChange = (days: number) => setFilters((f) => ({ ...f, days }));
  const handleOutcomeChange = (outcome: OutcomeFilter) => setFilters((f) => ({ ...f, outcome }));
  const handleModeChange = (mode: ModeFilter) => setFilters((f) => ({ ...f, mode }));

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 w-full">
      <HeroBanner
        onSync={onSync}
        syncing={syncing}
        error={syncError}
        windowLabel={summary?.window_label ?? (filters.days === 0 ? "All time" : `Last ${filters.days} days`)}
        totalRuns={summary?.total_runs ?? 0}
        successRate={summary?.success_rate ?? null}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <DaySelector value={filters.days} onChange={handleDaysChange} />
          <OutcomeToggle value={filters.outcome} onChange={handleOutcomeChange} />
          <ModeToggle value={filters.mode} onChange={handleModeChange} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="card p-8 text-center text-text-soft">Loading cronalytics…</div>
        </div>
      ) : (
        <>
          <SummaryBoard summary={summary} />
          <LeaderBoard jobs={jobs} onSelect={setSelectedJob} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <div className="lg:col-span-2">
              <JobBreakdown jobs={jobs} onSelect={setSelectedJob} />
            </div>
            <div>
              <ModelBreakdown models={models} />
            </div>
          </div>
          {summary && summary.top_failure_reasons.length > 0 && (
            <div className="card p-5 mb-6">
              <h2 className="text-sm font-semibold tracking-tight mb-3">Top failure reasons</h2>
              <ul className="space-y-1.5 text-sm">
                {summary.top_failure_reasons.map((r) => (
                  <li key={r.reason} className="flex items-baseline justify-between gap-2">
                    <span className="text-text-muted truncate" title={r.reason}>
                      {r.reason}
                    </span>
                    <span className="font-mono tabular-nums text-text-soft">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <JobDetailView
        job={selectedJob}
        days={filters.days}
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </main>
  );
}
