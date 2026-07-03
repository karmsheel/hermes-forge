/**
 * Cronalytics — schedule parser + pace computation.
 *
 * Mirrors cronalytics/schedule.py from the original plugin. We:
 *   1. Parse cron expressions to compute expected next/prev run timestamps.
 *   2. Compare the expected cadence to the actual observed cadence from
 *      cron_runs to produce a "pace" report (on-track / drifting / stuck).
 *
 * Uses cron-parser (already a dep of this app).
 */
import { CronExpressionParser } from "cron-parser";
import type { JobMeta } from "./types";

export interface ScheduleAnalysis {
  expected_interval_seconds: number | null;
  expected_next_run_at: number | null;
  expected_prev_run_at: number | null;
  human_readable: string | null;
}

const NO_SCHEDULE: ScheduleAnalysis = {
  expected_interval_seconds: null,
  expected_next_run_at: null,
  expected_prev_run_at: null,
  human_readable: null,
};

/**
 * Given a job's schedule expression (e.g. "30 7 * * *"), return the expected
 * interval in seconds and the next/prev run times. Returns null fields if
 * the expression can't be parsed.
 */
export function analyzeSchedule(expr: string | null | undefined, now = Date.now()): ScheduleAnalysis {
  if (!expr || typeof expr !== "string") return NO_SCHEDULE;
  try {
    const interval = CronExpressionParser.parse(expr, { currentDate: new Date(now) });
    const next = interval.next().toDate();
    const prev = interval.prev().toDate();
    const intervalSec = (next.getTime() - prev.getTime()) / 1000;
    return {
      expected_interval_seconds: intervalSec,
      expected_next_run_at: Math.floor(next.getTime() / 1000),
      expected_prev_run_at: Math.floor(prev.getTime() / 1000),
      human_readable: expr,
    };
  } catch {
    return { ...NO_SCHEDULE, human_readable: expr };
  }
}

export type PaceStatus = "on_track" | "drifting" | "stuck" | "no_schedule" | "no_runs";

export interface PaceResult {
  actual_seconds: number | null;
  expected_seconds: number | null;
  drift_pct: number | null;
  status: PaceStatus;
  next_expected_run_at: number | null;
}

/**
 * Compute a job's pace from its observed run history.
 *
 * - `runs`: at least 2 most-recent runs ordered newest-first. We use the
 *   most recent two to compute the actual cadence.
 * - `job`: the job's schedule metadata.
 * - `now`: reference time (unix seconds).
 */
export function computePace(
  runs: Array<{ run_time: number }>,
  job: Pick<JobMeta, "schedule">,
  now: number,
): PaceResult {
  const sched = analyzeSchedule(job.schedule, now * 1000);

  if (!job.schedule) {
    return {
      actual_seconds: null,
      expected_seconds: null,
      drift_pct: null,
      status: "no_schedule",
      next_expected_run_at: sched.expected_next_run_at,
    };
  }

  if (runs.length < 2) {
    return {
      actual_seconds: null,
      expected_seconds: sched.expected_interval_seconds,
      drift_pct: null,
      status: "no_runs",
      next_expected_run_at: sched.expected_next_run_at,
    };
  }

  // runs are newest-first
  const newest = runs[0].run_time;
  const prev = runs[1].run_time;
  const actual = newest - prev;
  const expected = sched.expected_interval_seconds ?? 0;

  if (expected <= 0) {
    return {
      actual_seconds: actual,
      expected_seconds: null,
      drift_pct: null,
      status: "on_track",
      next_expected_run_at: sched.expected_next_run_at,
    };
  }

  const drift = ((actual - expected) / expected) * 100;
  let status: PaceStatus = "on_track";
  if (actual > expected * 3) status = "stuck";
  else if (Math.abs(drift) > 25) status = "drifting";

  return {
    actual_seconds: actual,
    expected_seconds: expected,
    drift_pct: drift,
    status,
    next_expected_run_at: sched.expected_next_run_at,
  };
}
