/**
 * Cronalytics — row types and API response shapes.
 *
 * Mirrors the data model in skills/cronalytics/references/data-model.md from
 * the original plugin. Field names use snake_case to match the SQL column
 * names and the original Python contract; the API returns these directly.
 */

/** A single row in the cron_runs fact table. */
export interface CronRunRow {
  session_id: string;
  job_id: string;
  run_time: number; // unix seconds
  ended_at: number | null;
  duration_seconds: number | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  cost_status: string | null;
  cost_source: string | null;
  billing_provider: string | null;
  api_call_count: number;
  message_count: number;
  tool_call_count: number;
  end_reason: string | null;
  success: number | null; // 0/1
  job_mode: "agent" | "no_agent";
  ingested_at: number;
}

export interface SyncWatermark {
  last_ended_at: number;
  last_sync: string; // ISO
  rows_synced: number;
}

export interface JobMeta {
  id: string;
  name: string;
  schedule: string | null;
  schedule_display: string | null;
  no_agent: boolean;
  enabled?: boolean;
  last_status?: string | null;
  last_error?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
}

/** Aggregated per-job row returned by /api/cronalytics/jobs. */
export interface JobAggregate {
  job_id: string;
  name: string;
  schedule: string | null;
  schedule_display: string | null;
  no_agent: boolean;
  runs: number;
  successes: number;
  failures: number;
  success_rate: number | null; // 0..1
  avg_duration_seconds: number | null;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_reasoning_tokens: number;
  total_cache_read_tokens: number;
  total_cache_write_tokens: number;
  last_run_at: number | null;
  last_status: string | null;
  // Pace: actual interval between runs vs expected interval
  pace_actual_seconds: number | null;
  pace_expected_seconds: number | null;
  pace_drift_pct: number | null; // ((actual - expected) / expected) * 100
  pace_status: "on_track" | "drifting" | "stuck" | "no_schedule" | "no_runs";
  next_expected_run_at: number | null;
}

export interface SummaryResponse {
  window_days: number; // 0 = all time
  window_label: string;
  total_runs: number;
  total_successes: number;
  total_failures: number;
  success_rate: number | null;
  tot_estimated_cost_usd: number;
  tot_actual_cost_usd: number;
  tot_input_tokens: number;
  tot_output_tokens: number;
  tot_reasoning_tokens: number;
  tot_cache_read_tokens: number;
  tot_cache_write_tokens: number;
  avg_duration_seconds: number | null;
  median_duration_seconds: number | null;
  job_count: number;
  model_count: number;
  first_run_at: number | null;
  last_run_at: number | null;
  previous_period: {
    runs: number;
    successes: number;
    failures: number;
    estimated_cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  } | null;
  cost_pct_change: number | null;
  run_pct_change: number | null;
  top_failure_reasons: Array<{ reason: string; count: number }>;
}

export interface TrendsResponse {
  window_days: number;
  buckets: Array<{
    date: string; // YYYY-MM-DD
    runs: number;
    successes: number;
    failures: number;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  }>;
}

export interface ModelsResponse {
  window_days: number;
  models: Array<{
    model: string;
    runs: number;
    successes: number;
    failures: number;
    total_cost_usd: number;
    total_input_tokens: number;
    total_output_tokens: number;
    avg_cost_per_run: number;
  }>;
}

export interface HealthResponse {
  ok: boolean;
  fact_db_path: string;
  hermes_home: string;
  hermes_state_db: string;
  hermes_jobs_json: string;
  hermes_reachable: boolean;
  hermes_error: string | null;
  fact_db_exists: boolean;
  cron_run_count: number;
  sync: SyncWatermark | null;
  schema_version: number;
}

export type OutcomeFilter = "all" | "success" | "failure";
export type ModeFilter = "all" | "agent" | "no_agent";

export interface CommonFilters {
  days: number; // 0 = all time
  outcome: OutcomeFilter;
  mode: ModeFilter;
}

export function parseFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): CommonFilters {
  const get = (k: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(k) ?? undefined;
    const v = (searchParams as Record<string, string | string[] | undefined>)[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const daysRaw = get("days");
  const days = daysRaw === undefined ? 30 : Number.parseInt(daysRaw, 10);
  const outcome = (get("outcome") ?? "all") as OutcomeFilter;
  const mode = (get("mode") ?? "all") as ModeFilter;
  return {
    days: Number.isFinite(days) ? Math.max(0, days) : 30,
    outcome: ["all", "success", "failure"].includes(outcome) ? outcome : "all",
    mode: ["all", "agent", "no_agent"].includes(mode) ? mode : "all",
  };
}
