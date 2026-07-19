/**
 * Owner-facing automation run health (Phase 7.1).
 *
 * Combines Hermes job last-run state with optional Cronalytics fact-DB
 * history so operators never need the Cronalytics dev tool for day-to-day.
 */

import type { HermesJobSummary } from '@/lib/hermes-jobs';

/** Automation.status values for deployed Hermes crons. */
export type AutomationRuntimeStatus = 'active' | 'paused' | 'failed';

export type RunOutcome = 'success' | 'failed' | 'unknown';

export interface RecentRunSummary {
  at: string | null;
  outcome: RunOutcome;
  error: string | null;
  durationSeconds: number | null;
}

export interface AutomationRunHealth {
  jobId: string;
  /** Mapped Automation.status for deployed crons. */
  runtimeStatus: AutomationRuntimeStatus;
  hermesStatus: string | null;
  schedule: string | null;
  lastRunAt: string | null;
  lastOutcome: RunOutcome;
  lastError: string | null;
  nextRunAt: string | null;
  /** From Cronalytics when available; else estimated from last outcome. */
  recentFailures: number;
  recentSuccesses: number;
  recentRuns: number;
  consecutiveFailures: number;
  successRate: number | null;
  /** Short owner-facing line. */
  summary: string;
  /** True when we should surface a soft alert. */
  unhealthy: boolean;
  source: 'hermes' | 'hermes+cronalytics' | 'status_only';
}

/** Consecutive failures before soft alert. */
export const FAILURE_ALERT_THRESHOLD = 3;

export function mapHermesJobStatus(status?: string | null, enabled?: boolean): AutomationRuntimeStatus {
  if (enabled === false) return 'paused';
  if (!status) return 'active';
  const normalized = status.toLowerCase().trim();
  if (
    normalized === 'paused' ||
    normalized === 'disabled' ||
    normalized === 'inactive' ||
    normalized === 'stopped'
  ) {
    return 'paused';
  }
  if (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'failing' ||
    normalized === 'broken'
  ) {
    return 'failed';
  }
  return 'active';
}

export function mapRunOutcome(raw?: string | null, successFlag?: number | boolean | null): RunOutcome {
  if (typeof successFlag === 'boolean') return successFlag ? 'success' : 'failed';
  if (successFlag === 1) return 'success';
  if (successFlag === 0) return 'failed';
  if (!raw) return 'unknown';
  const n = raw.toLowerCase().trim();
  if (
    n === 'success' ||
    n === 'ok' ||
    n === 'completed' ||
    n === 'succeeded' ||
    n === 'healthy'
  ) {
    return 'success';
  }
  if (
    n === 'failed' ||
    n === 'failure' ||
    n === 'error' ||
    n === 'fail' ||
    n === 'errored' ||
    n === 'timeout' ||
    n === 'cancelled' ||
    n === 'canceled'
  ) {
    return 'failed';
  }
  return 'unknown';
}

export function formatRunHealthSummary(input: {
  runtimeStatus: AutomationRuntimeStatus;
  lastOutcome: RunOutcome;
  lastRunAt: string | null;
  consecutiveFailures: number;
  recentRuns: number;
  successRate: number | null;
}): string {
  if (input.runtimeStatus === 'paused') {
    return 'Paused — scheduled runs are suspended';
  }

  if (input.consecutiveFailures >= FAILURE_ALERT_THRESHOLD) {
    return `${input.consecutiveFailures} consecutive failures — needs attention`;
  }

  if (input.runtimeStatus === 'failed' || input.lastOutcome === 'failed') {
    return 'Last run failed';
  }

  if (input.recentRuns === 0 && !input.lastRunAt) {
    return 'No runs recorded yet';
  }

  if (input.successRate != null && input.recentRuns > 0) {
    const pct = Math.round(input.successRate * 100);
    return `${pct}% success over last ${input.recentRuns} run${input.recentRuns === 1 ? '' : 's'}`;
  }

  if (input.lastOutcome === 'success') {
    return 'Last run succeeded';
  }

  return 'Run health unknown — connect Hermes to refresh';
}

export function buildRunHealthFromJob(
  job: HermesJobSummary,
  options?: {
    recentFailures?: number;
    recentSuccesses?: number;
    recentRuns?: number;
    consecutiveFailures?: number;
    source?: AutomationRunHealth['source'];
  }
): AutomationRunHealth {
  const lastOutcome = mapRunOutcome(job.lastStatus);
  const runtimeStatus = mapHermesJobStatus(job.status, job.enabled);

  // If Hermes marks the job active but last run failed repeatedly via facts, surface failed.
  let status = runtimeStatus;
  const consecutive =
    options?.consecutiveFailures ??
    (lastOutcome === 'failed' ? 1 : 0);

  if (status === 'active' && consecutive >= FAILURE_ALERT_THRESHOLD) {
    status = 'failed';
  }

  const recentFailures = options?.recentFailures ?? (lastOutcome === 'failed' ? 1 : 0);
  const recentSuccesses = options?.recentSuccesses ?? (lastOutcome === 'success' ? 1 : 0);
  const recentRuns =
    options?.recentRuns ??
    (lastOutcome === 'unknown' && !job.lastRunAt ? 0 : Math.max(1, recentFailures + recentSuccesses));

  const successRate =
    recentRuns > 0 ? recentSuccesses / recentRuns : lastOutcome === 'success' ? 1 : null;

  const unhealthy =
    status === 'failed' ||
    consecutive >= FAILURE_ALERT_THRESHOLD ||
    (lastOutcome === 'failed' && status !== 'paused');

  return {
    jobId: job.id,
    runtimeStatus: status,
    hermesStatus: job.status ?? null,
    schedule: job.schedule ?? null,
    lastRunAt: job.lastRunAt ?? null,
    lastOutcome,
    lastError: job.lastError ?? null,
    nextRunAt: job.nextRunAt ?? null,
    recentFailures,
    recentSuccesses,
    recentRuns,
    consecutiveFailures: consecutive,
    successRate,
    summary: formatRunHealthSummary({
      runtimeStatus: status,
      lastOutcome,
      lastRunAt: job.lastRunAt ?? null,
      consecutiveFailures: consecutive,
      recentRuns,
      successRate,
    }),
    unhealthy,
    source: options?.source ?? 'hermes',
  };
}

export function buildRunHealthFromStatusOnly(
  jobId: string,
  status: string
): AutomationRunHealth {
  const runtimeStatus =
    status === 'paused' || status === 'failed'
      ? (status as AutomationRuntimeStatus)
      : 'active';

  return {
    jobId,
    runtimeStatus,
    hermesStatus: status,
    schedule: null,
    lastRunAt: null,
    lastOutcome: 'unknown',
    lastError: null,
    nextRunAt: null,
    recentFailures: 0,
    recentSuccesses: 0,
    recentRuns: 0,
    consecutiveFailures: 0,
    successRate: null,
    summary: formatRunHealthSummary({
      runtimeStatus,
      lastOutcome: 'unknown',
      lastRunAt: null,
      consecutiveFailures: 0,
      recentRuns: 0,
      successRate: null,
    }),
    unhealthy: runtimeStatus === 'failed',
    source: 'status_only',
  };
}

/**
 * Count consecutive failures from newest→oldest run outcomes.
 * outcomes[0] is the most recent run.
 */
export function countConsecutiveFailures(outcomes: RunOutcome[]): number {
  let n = 0;
  for (const o of outcomes) {
    if (o === 'failed') n += 1;
    else if (o === 'success') break;
    // skip unknown without breaking the streak? treat unknown as break to be conservative
    else break;
  }
  return n;
}

/** Whether a soft alert should fire given current health and prior alert state. */
export function shouldAlertOnFailures(
  health: Pick<AutomationRunHealth, 'consecutiveFailures' | 'unhealthy' | 'runtimeStatus'>,
  options?: { alreadyAlertedRecently?: boolean }
): boolean {
  if (options?.alreadyAlertedRecently) return false;
  if (health.runtimeStatus === 'paused') return false;
  // Soft alerts only on repeated failures (not a single blip).
  return health.consecutiveFailures >= FAILURE_ALERT_THRESHOLD;
}

export function cronRunToOutcome(success: number | null | undefined): RunOutcome {
  if (success === 1) return 'success';
  if (success === 0) return 'failed';
  return 'unknown';
}
