/**
 * Cronalytics — jobs.json reader + enrichment.
 *
 * Mirrors dashboard/plugin_api.py:50-90 from the original plugin. Loads the
 * Hermes `cron/jobs.json` file (which contains the human-defined schedule
 * metadata: name, schedule expression, no_agent flag, last_status, etc.)
 * and exposes a lookup by job_id.
 */
import fs from "fs";
import { getJobsJsonPath, probeHermes } from "./paths";
import type { JobMeta } from "./types";

interface JobsJson {
  jobs: Array<{
    id: string;
    name?: string;
    schedule?: { kind: string; expr?: string; display?: string } | string | null;
    schedule_display?: string | null;
    no_agent?: boolean;
    enabled?: boolean;
    state?: string;
    last_status?: string | null;
    last_error?: string | null;
    last_run_at?: string | null;
    next_run_at?: string | null;
  }>;
  updated_at?: string;
}

let _cached: { mtime: number; map: Map<string, JobMeta> } | null = null;

/** Read all jobs from jobs.json. Cached by file mtime. */
export function loadJobs(): Map<string, JobMeta> {
  const probe = probeHermes();
  if (!probe.ok) return new Map();

  const jobsPath = getJobsJsonPath(probe.home);
  if (!fs.existsSync(jobsPath)) return new Map();

  const stat = fs.statSync(jobsPath);
  if (_cached && _cached.mtime === stat.mtimeMs) return _cached.map;

  let parsed: JobsJson = { jobs: [] };
  try {
    parsed = JSON.parse(fs.readFileSync(jobsPath, "utf-8")) as JobsJson;
  } catch {
    parsed = { jobs: [] };
  }

  const map = new Map<string, JobMeta>();
  for (const j of parsed.jobs ?? []) {
    if (!j.id) continue;
    const scheduleExpr = extractScheduleExpr(j.schedule);
    const scheduleDisplay = j.schedule_display ?? (typeof j.schedule === "string" ? j.schedule : null) ?? scheduleExpr;
    map.set(j.id, {
      id: j.id,
      name: j.name ?? j.id,
      schedule: scheduleExpr,
      schedule_display: scheduleDisplay,
      no_agent: Boolean(j.no_agent),
      enabled: j.enabled,
      last_status: j.last_status ?? null,
      last_error: j.last_error ?? null,
      last_run_at: j.last_run_at ?? null,
      next_run_at: j.next_run_at ?? null,
    });
  }
  _cached = { mtime: stat.mtimeMs, map };
  return map;
}

function extractScheduleExpr(s: JobsJson["jobs"][number]["schedule"]): string | null {
  if (!s) return null;
  if (typeof s === "string") return s;
  if (typeof s === "object" && s.expr) return s.expr;
  return null;
}

/** Reset the cache (useful for tests or after a manual jobs.json edit). */
export function invalidateJobsCache(): void {
  _cached = null;
}

/**
 * Build a no_agent map suitable for the scanner. Wraps loadJobs() in a
 * smaller surface so callers don't need to know about JobMeta.
 */
export function buildNoAgentMap(): Map<string, { no_agent: boolean }> {
  const out = new Map<string, { no_agent: boolean }>();
  for (const [id, meta] of Array.from(loadJobs())) {
    out.set(id, { no_agent: meta.no_agent });
  }
  return out;
}
