/**
 * Cronalytics — aggregation queries.
 *
 * Reads from the fact DB and produces the summary/jobs/models/trends
 * shapes that the API returns. All filters (days, outcome, mode) compose.
 */
import { getFactDb, getSchemaVersion } from "./db";
import { loadJobs } from "./jobs";
import { computePace } from "./schedule";
import type {
  CommonFilters,
  JobAggregate,
  JobMeta,
  ModelsResponse,
  SummaryResponse,
  TrendsResponse,
} from "./types";

/** Compute the unix-seconds cutoff for a "days" filter. 0 = all time. */
export function cutoffFromDays(days: number, now = Math.floor(Date.now() / 1000)): number {
  if (!days || days <= 0) return 0;
  return now - days * 86400;
}

/** WHERE clauses appended to every aggregate query. */
function buildWhere(f: CommonFilters, extra: string[] = []): { sql: string; params: Record<string, unknown> } {
  const parts: string[] = [];
  const params: Record<string, unknown> = {};

  if (f.days > 0) {
    parts.push("run_time >= $cutoff");
    params.$cutoff = cutoffFromDays(f.days);
  }
  if (f.outcome === "success") {
    parts.push("success = 1");
  } else if (f.outcome === "failure") {
    parts.push("success = 0");
  }
  if (f.mode === "agent") {
    parts.push("job_mode = 'agent'");
  } else if (f.mode === "no_agent") {
    parts.push("job_mode = 'no_agent'");
  }
  for (const e of extra) parts.push(e);

  return { sql: parts.length ? "WHERE " + parts.join(" AND ") : "", params };
}

export function computeSummary(f: CommonFilters): SummaryResponse {
  const db = getFactDb();
  const where = buildWhere(f);

  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) as runs,
        COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successes,
        COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failures,
        COALESCE(SUM(COALESCE(estimated_cost_usd, actual_cost_usd, 0)), 0) as tot_estimated_cost_usd,
        COALESCE(SUM(COALESCE(actual_cost_usd, 0)), 0) as tot_actual_cost_usd,
        COALESCE(SUM(input_tokens), 0) as tot_input_tokens,
        COALESCE(SUM(output_tokens), 0) as tot_output_tokens,
        COALESCE(SUM(reasoning_tokens), 0) as tot_reasoning_tokens,
        COALESCE(SUM(cache_read_tokens), 0) as tot_cache_read_tokens,
        COALESCE(SUM(cache_write_tokens), 0) as tot_cache_write_tokens,
        AVG(duration_seconds) as avg_duration_seconds,
        MIN(run_time) as first_run_at,
        MAX(run_time) as last_run_at
      FROM cron_runs
      ${where.sql}
    `,
    )
    .get(where.params) as {
    runs: number;
    successes: number;
    failures: number;
    tot_estimated_cost_usd: number;
    tot_actual_cost_usd: number;
    tot_input_tokens: number;
    tot_output_tokens: number;
    tot_reasoning_tokens: number;
    tot_cache_read_tokens: number;
    tot_cache_write_tokens: number;
    avg_duration_seconds: number | null;
    first_run_at: number | null;
    last_run_at: number | null;
  };

  // Median duration — separate query (SQLite lacks MEDIAN).
  const durations = db
    .prepare(
      `SELECT duration_seconds FROM cron_runs ${where.sql} ${
        where.sql ? "AND" : "WHERE"
      } duration_seconds IS NOT NULL ORDER BY duration_seconds`,
    )
    .all(where.params) as Array<{ duration_seconds: number }>;
  let median: number | null = null;
  if (durations.length > 0) {
    const mid = Math.floor(durations.length / 2);
    median =
      durations.length % 2 === 0
        ? (durations[mid - 1].duration_seconds + durations[mid].duration_seconds) / 2
        : durations[mid].duration_seconds;
  }

  // Top failure reasons.
  const topFailure = db
    .prepare(
      `
      SELECT end_reason as reason, COUNT(*) as count
      FROM cron_runs
      ${where.sql} ${where.sql ? "AND" : "WHERE"} success = 0 AND end_reason IS NOT NULL
      GROUP BY end_reason
      ORDER BY count DESC
      LIMIT 5
    `,
    )
    .all(where.params) as Array<{ reason: string; count: number }>;

  // Job / model counts in the window.
  const jobCount = db
    .prepare(`SELECT COUNT(DISTINCT job_id) as n FROM cron_runs ${where.sql}`)
    .get(where.params) as { n: number };

  const modelCount = db
    .prepare(
      `SELECT COUNT(DISTINCT model) as n FROM cron_runs ${where.sql} ${
        where.sql ? "AND" : "WHERE"
      } model IS NOT NULL`,
    )
    .get(where.params) as { n: number };

  // Previous period: same length immediately preceding the current window.
  let previousPeriod: SummaryResponse["previous_period"] = null;
  if (f.days > 0) {
    const prevWhere = buildWhere(f, ["run_time < $cutoff", `run_time >= $cutoff - ${f.days} * 86400`]);
    const prev = db
      .prepare(
        `SELECT
          COUNT(*) as runs,
          COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successes,
          COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failures,
          COALESCE(SUM(COALESCE(estimated_cost_usd, actual_cost_usd, 0)), 0) as estimated_cost_usd,
          COALESCE(SUM(input_tokens), 0) as input_tokens,
          COALESCE(SUM(output_tokens), 0) as output_tokens
        FROM cron_runs
        ${prevWhere.sql}`,
      )
      .get(prevWhere.params) as {
      runs: number;
      successes: number;
      failures: number;
      estimated_cost_usd: number;
      input_tokens: number;
      output_tokens: number;
    };
    previousPeriod = prev;
  }

  const costPct = previousPeriod && previousPeriod.estimated_cost_usd
    ? ((totals.tot_estimated_cost_usd - previousPeriod.estimated_cost_usd) / previousPeriod.estimated_cost_usd) * 100
    : null;
  const runPct = previousPeriod && previousPeriod.runs
    ? ((totals.runs - previousPeriod.runs) / previousPeriod.runs) * 100
    : null;

  return {
    window_days: f.days,
    window_label: f.days === 0 ? "All time" : `Last ${f.days} days`,
    total_runs: totals.runs,
    total_successes: totals.successes,
    total_failures: totals.failures,
    success_rate: totals.runs ? totals.successes / totals.runs : null,
    tot_estimated_cost_usd: round2(totals.tot_estimated_cost_usd),
    tot_actual_cost_usd: round2(totals.tot_actual_cost_usd),
    tot_input_tokens: totals.tot_input_tokens,
    tot_output_tokens: totals.tot_output_tokens,
    tot_reasoning_tokens: totals.tot_reasoning_tokens,
    tot_cache_read_tokens: totals.tot_cache_read_tokens,
    tot_cache_write_tokens: totals.tot_cache_write_tokens,
    avg_duration_seconds: totals.avg_duration_seconds != null ? round2(totals.avg_duration_seconds) : null,
    median_duration_seconds: median != null ? round2(median) : null,
    job_count: jobCount.n,
    model_count: modelCount.n,
    first_run_at: totals.first_run_at,
    last_run_at: totals.last_run_at,
    previous_period: previousPeriod
      ? {
          runs: previousPeriod.runs,
          successes: previousPeriod.successes,
          failures: previousPeriod.failures,
          estimated_cost_usd: round2(previousPeriod.estimated_cost_usd),
          input_tokens: previousPeriod.input_tokens,
          output_tokens: previousPeriod.output_tokens,
        }
      : null,
    cost_pct_change: costPct != null ? round2(costPct) : null,
    run_pct_change: runPct != null ? round2(runPct) : null,
    top_failure_reasons: topFailure,
  };
}

export function computeJobs(f: CommonFilters): { jobs: JobAggregate[] } {
  const db = getFactDb();
  const where = buildWhere(f);
  const jobs = loadJobs();

  const rows = db
    .prepare(
      `
      SELECT
        job_id,
        COUNT(*) as runs,
        COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successes,
        COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failures,
        AVG(duration_seconds) as avg_duration_seconds,
        COALESCE(SUM(COALESCE(estimated_cost_usd, actual_cost_usd, 0)), 0) as total_cost_usd,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(reasoning_tokens), 0) as total_reasoning_tokens,
        COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
        COALESCE(SUM(cache_write_tokens), 0) as total_cache_write_tokens,
        MAX(run_time) as last_run_at
      FROM cron_runs
      ${where.sql}
      GROUP BY job_id
      ORDER BY total_cost_usd DESC
    `,
    )
    .all(where.params) as Array<{
    job_id: string;
    runs: number;
    successes: number;
    failures: number;
    avg_duration_seconds: number | null;
    total_cost_usd: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_reasoning_tokens: number;
    total_cache_read_tokens: number;
    total_cache_write_tokens: number;
    last_run_at: number | null;
  }>;

  const now = Math.floor(Date.now() / 1000);

  const aggregates: JobAggregate[] = rows.map((r) => {
    // Get the last 2 runs for pace calculation.
    const recentRuns = db
      .prepare(
        `SELECT run_time FROM cron_runs WHERE job_id = $job_id ORDER BY run_time DESC LIMIT 2`,
      )
      .all({ $job_id: r.job_id }) as Array<{ run_time: number }>;

    const meta: JobMeta = jobs.get(r.job_id) ?? {
      id: r.job_id,
      name: r.job_id,
      schedule: null,
      schedule_display: null,
      no_agent: false,
    };
    const pace = computePace(recentRuns, meta, now);

    return {
      job_id: r.job_id,
      name: meta.name,
      schedule: meta.schedule,
      schedule_display: meta.schedule_display,
      no_agent: meta.no_agent,
      runs: r.runs,
      successes: r.successes,
      failures: r.failures,
      success_rate: r.runs ? r.successes / r.runs : null,
      avg_duration_seconds: r.avg_duration_seconds != null ? round2(r.avg_duration_seconds) : null,
      total_cost_usd: round2(r.total_cost_usd),
      total_input_tokens: r.total_input_tokens,
      total_output_tokens: r.total_output_tokens,
      total_reasoning_tokens: r.total_reasoning_tokens,
      total_cache_read_tokens: r.total_cache_read_tokens,
      total_cache_write_tokens: r.total_cache_write_tokens,
      last_run_at: r.last_run_at,
      last_status: meta.last_status ?? null,
      pace_actual_seconds: pace.actual_seconds,
      pace_expected_seconds: pace.expected_seconds,
      pace_drift_pct: pace.drift_pct != null ? round2(pace.drift_pct) : null,
      pace_status: pace.status,
      next_expected_run_at: pace.next_expected_run_at,
    };
  });

  return { jobs: aggregates };
}

export function computeRunsForJob(jobId: string, f: CommonFilters): { runs: Array<Record<string, unknown>> } {
  const db = getFactDb();
  const where = buildWhere(f, ["job_id = $job_id"]);
  const rows = db
    .prepare(
      `SELECT * FROM cron_runs ${where.sql} ORDER BY run_time DESC LIMIT 200`,
    )
    .all({ ...where.params, $job_id: jobId }) as Array<Record<string, unknown>>;
  return { runs: rows };
}

export function computeModels(f: CommonFilters): ModelsResponse {
  const db = getFactDb();
  const where = buildWhere(f);
  const rows = db
    .prepare(
      `
      SELECT
        model,
        COUNT(*) as runs,
        COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successes,
        COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failures,
        COALESCE(SUM(COALESCE(estimated_cost_usd, actual_cost_usd, 0)), 0) as total_cost_usd,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens
      FROM cron_runs
      ${where.sql} ${where.sql ? "AND" : "WHERE"} model IS NOT NULL
      GROUP BY model
      ORDER BY total_cost_usd DESC
    `,
    )
    .all(where.params) as Array<{
    model: string;
    runs: number;
    successes: number;
    failures: number;
    total_cost_usd: number;
    total_input_tokens: number;
    total_output_tokens: number;
  }>;
  return {
    window_days: f.days,
    models: rows.map((r) => ({
      model: r.model,
      runs: r.runs,
      successes: r.successes,
      failures: r.failures,
      total_cost_usd: round2(r.total_cost_usd),
      total_input_tokens: r.total_input_tokens,
      total_output_tokens: r.total_output_tokens,
      avg_cost_per_run: r.runs ? round2(r.total_cost_usd / r.runs) : 0,
    })),
  };
}

export function computeTrends(f: CommonFilters): TrendsResponse {
  const db = getFactDb();
  const where = buildWhere(f);
  const rows = db
    .prepare(
      `
      SELECT
        strftime('%Y-%m-%d', run_time, 'unixepoch') as date,
        COUNT(*) as runs,
        COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successes,
        COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failures,
        COALESCE(SUM(COALESCE(estimated_cost_usd, actual_cost_usd, 0)), 0) as cost_usd,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens
      FROM cron_runs
      ${where.sql}
      GROUP BY date
      ORDER BY date ASC
    `,
    )
    .all(where.params) as Array<{
    date: string;
    runs: number;
    successes: number;
    failures: number;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  }>;
  return { window_days: f.days, buckets: rows.map((r) => ({ ...r, cost_usd: round2(r.cost_usd) })) };
}

export function getSchemaVersionSafe(): number {
  try {
    return getSchemaVersion();
  } catch {
    return 0;
  }
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
