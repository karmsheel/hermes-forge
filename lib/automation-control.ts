/**
 * Pause / resume / refresh run health for deployed Hermes cron automations (7.1).
 */
import { prisma } from '@/lib/prisma';
import {
  buildRunHealthFromJob,
  buildRunHealthFromStatusOnly,
  countConsecutiveFailures,
  cronRunToOutcome,
  mapHermesJobStatus,
  shouldAlertOnFailures,
  type AutomationRunHealth,
  type RunOutcome,
} from '@/lib/automation-run-health';
import {
  getHermesJob,
  listHermesJobs,
  pauseHermesJob,
  resumeHermesJob,
  type HermesJobSummary,
} from '@/lib/hermes-jobs';
import {
  loadAutomationWithRelations,
  serializeAutomation,
} from '@/lib/automation-access';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import type { AutomationWithMessages } from '@/lib/automation-types';

const automationInclude = {
  messages: { orderBy: { createdAt: 'asc' as const } },
  hermesAgentProfile: {
    select: {
      id: true,
      displayName: true,
      profileKey: true,
      description: true,
      model: true,
      isHired: true,
      isDefault: true,
      iconKey: true,
    },
  },
  process: {
    select: {
      id: true,
      name: true,
      businessId: true,
      business: { select: { userId: true } },
    },
  },
} as const;

/** Soft alert dedupe window. */
const ALERT_DEDUPE_MS = 24 * 60 * 60 * 1000;

export type ControlAction = 'pause' | 'resume';

function findJobInList(
  jobs: HermesJobSummary[],
  jobId: string
): HermesJobSummary | undefined {
  return jobs.find((j) => j.id === jobId);
}

/**
 * Best-effort Cronalytics recent-run stats for a Hermes job id.
 * Returns null when the fact DB is unavailable (desktop without sync, tests, etc.).
 */
export function readCronalyticsJobStats(jobId: string): {
  recentFailures: number;
  recentSuccesses: number;
  recentRuns: number;
  consecutiveFailures: number;
  lastRunAt: string | null;
  lastOutcome: RunOutcome;
  lastError: string | null;
} | null {
  try {
    // Lazy load so unit tests and environments without node:sqlite still import this module.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cronDb = require('@/lib/cronalytics/db') as {
      getFactDb: () => {
        prepare: (sql: string) => {
          all: (params: Record<string, unknown>) => unknown[];
        };
      };
    };
    const db = cronDb.getFactDb();
    const rows = db
      .prepare(
        `
        SELECT success, run_time, end_reason, duration_seconds
        FROM cron_runs
        WHERE job_id = $job_id
        ORDER BY run_time DESC
        LIMIT 20
      `
      )
      .all({ $job_id: jobId }) as Array<{
      success: number | null;
      run_time: number | null;
      end_reason: string | null;
      duration_seconds: number | null;
    }>;

    if (!rows.length) return null;

    const outcomes = rows.map((r) => cronRunToOutcome(r.success));
    const recentFailures = outcomes.filter((o) => o === 'failed').length;
    const recentSuccesses = outcomes.filter((o) => o === 'success').length;
    const first = rows[0];
    const lastRunAt =
      first.run_time != null ? new Date(first.run_time * 1000).toISOString() : null;

    return {
      recentFailures,
      recentSuccesses,
      recentRuns: rows.length,
      consecutiveFailures: countConsecutiveFailures(outcomes),
      lastRunAt,
      lastOutcome: outcomes[0] ?? 'unknown',
      lastError: first.end_reason ?? null,
    };
  } catch {
    return null;
  }
}

export function mergeHealthWithCronalytics(
  job: HermesJobSummary
): AutomationRunHealth {
  const stats = readCronalyticsJobStats(job.id);
  if (!stats) {
    return buildRunHealthFromJob(job, { source: 'hermes' });
  }

  // Prefer Cronalytics last-run when Hermes omits it.
  const enriched: HermesJobSummary = {
    ...job,
    lastRunAt: job.lastRunAt ?? stats.lastRunAt,
    lastStatus:
      job.lastStatus ??
      (stats.lastOutcome === 'success'
        ? 'success'
        : stats.lastOutcome === 'failed'
          ? 'failed'
          : undefined),
    lastError: job.lastError ?? stats.lastError,
  };

  return buildRunHealthFromJob(enriched, {
    recentFailures: stats.recentFailures,
    recentSuccesses: stats.recentSuccesses,
    recentRuns: stats.recentRuns,
    consecutiveFailures: stats.consecutiveFailures,
    source: 'hermes+cronalytics',
  });
}

export async function resolveJobHealth(
  baseUrl: string,
  apiKey: string,
  jobId: string
): Promise<AutomationRunHealth> {
  try {
    const job = await getHermesJob(baseUrl, apiKey, jobId);
    return mergeHealthWithCronalytics(job);
  } catch {
    // Fall back to list endpoint if get-by-id is unsupported on older Hermes.
    const jobs = await listHermesJobs(baseUrl, apiKey);
    const job = findJobInList(jobs, jobId);
    if (!job) {
      return buildRunHealthFromStatusOnly(jobId, 'active');
    }
    return mergeHealthWithCronalytics(job);
  }
}

async function hasRecentFailureAlert(
  businessId: string,
  userId: string,
  automationId: string
): Promise<boolean> {
  const since = new Date(Date.now() - ALERT_DEDUPE_MS);
  const existing = await prisma.notification.findFirst({
    where: {
      businessId,
      userId,
      type: 'automation_run_failed',
      createdAt: { gte: since },
      body: { contains: automationId },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Persist runtime status on Automation and optionally soft-alert the owner.
 */
export async function applyRuntimeStatus(input: {
  automationId: string;
  processId: string;
  processName: string;
  businessId: string;
  ownerUserId: string;
  actorUserId?: string | null;
  health: AutomationRunHealth;
  logEvent?: boolean;
}): Promise<void> {
  await prisma.automation.update({
    where: { id: input.automationId },
    data: { status: input.health.runtimeStatus },
  });

  if (input.logEvent) {
    await recordBusinessEvent({
      businessId: input.businessId,
      userId: input.actorUserId ?? undefined,
      type: BUSINESS_EVENT_TYPES.AUTOMATION_STATUS_CHANGED,
      entityType: 'automation',
      entityId: input.processId,
      entityName: input.processName,
      summary: `Automation "${input.processName}" is now ${input.health.runtimeStatus}`,
      metadata: {
        status: input.health.runtimeStatus,
        type: 'hermes_cron',
        agentId: input.automationId,
      },
      ...liveOccurredNow(),
    });
  }

  const alreadyAlerted = await hasRecentFailureAlert(
    input.businessId,
    input.ownerUserId,
    input.automationId
  );

  if (
    shouldAlertOnFailures(input.health, { alreadyAlertedRecently: alreadyAlerted }) &&
    input.health.runtimeStatus !== 'paused'
  ) {
    const failLine =
      input.health.consecutiveFailures >= 2
        ? `${input.health.consecutiveFailures} consecutive failures`
        : 'Last run failed';
    await prisma.notification.create({
      data: {
        businessId: input.businessId,
        userId: input.ownerUserId,
        type: 'automation_run_failed',
        title: `Automation issue: ${input.processName.slice(0, 80)}`,
        // Embed automation id for dedupe lookups; UI shows title/body only.
        body: `${failLine} on "${input.processName}". Open Automate to pause or inspect. [${input.automationId}]`,
      },
    });
  }
}

export async function controlAutomationCron(input: {
  processId: string;
  action: ControlAction;
  baseUrl: string;
  apiKey: string;
  userId: string;
}): Promise<{
  automation: AutomationWithMessages;
  health: AutomationRunHealth;
}> {
  const row = await prisma.automation.findUnique({
    where: { processId: input.processId },
    include: automationInclude,
  });

  if (!row) {
    throw new Error('Automation not found');
  }
  if (row.type && row.type !== 'hermes_cron') {
    throw new Error('Pause/resume is only available for Hermes cron automations');
  }
  if (!row.externalId) {
    throw new Error('Deploy a Hermes cron job before pause/resume');
  }

  if (input.action === 'pause') {
    await pauseHermesJob(input.baseUrl, input.apiKey, row.externalId);
  } else {
    await resumeHermesJob(input.baseUrl, input.apiKey, row.externalId);
  }

  // Re-fetch health after control so status reflects Hermes.
  let health: AutomationRunHealth;
  try {
    health = await resolveJobHealth(input.baseUrl, input.apiKey, row.externalId);
  } catch {
    health = buildRunHealthFromStatusOnly(
      row.externalId,
      input.action === 'pause' ? 'paused' : 'active'
    );
  }

  // Force expected status if Hermes body omitted it.
  if (input.action === 'pause' && health.runtimeStatus !== 'paused') {
    health = { ...health, runtimeStatus: 'paused', summary: 'Paused — scheduled runs are suspended' };
  }
  if (input.action === 'resume' && health.runtimeStatus === 'paused') {
    health = {
      ...health,
      runtimeStatus: 'active',
      summary: formatActiveSummary(health),
    };
  }

  await applyRuntimeStatus({
    automationId: row.id,
    processId: row.process.id,
    processName: row.process.name,
    businessId: row.process.businessId,
    ownerUserId: row.process.business.userId,
    actorUserId: input.userId,
    health,
    logEvent: true,
  });

  const automation = await loadAutomationWithRelations(row.id);
  return { automation, health };
}

function formatActiveSummary(health: AutomationRunHealth): string {
  if (health.lastOutcome === 'failed') return 'Last run failed';
  if (health.lastOutcome === 'success') return 'Last run succeeded';
  if (health.recentRuns === 0) return 'No runs recorded yet';
  return health.summary.replace(/^Paused — .*/, 'Resumed');
}

export async function refreshAutomationHealth(input: {
  processId: string;
  baseUrl: string;
  apiKey: string;
  /** When true, may create failure notifications. Default true. */
  alert?: boolean;
}): Promise<{
  automation: AutomationWithMessages;
  health: AutomationRunHealth;
}> {
  const row = await prisma.automation.findUnique({
    where: { processId: input.processId },
    include: automationInclude,
  });

  if (!row) {
    throw new Error('Automation not found');
  }

  if (!row.externalId || row.type === 'n8n_workflow') {
    const automation = serializeAutomation(row);
    const health = buildRunHealthFromStatusOnly(
      row.externalId ?? row.id,
      row.status
    );
    return { automation, health };
  }

  const health = await resolveJobHealth(input.baseUrl, input.apiKey, row.externalId);

  const prevStatus = mapHermesJobStatus(row.status);
  await applyRuntimeStatus({
    automationId: row.id,
    processId: row.process.id,
    processName: row.process.name,
    businessId: row.process.businessId,
    ownerUserId: row.process.business.userId,
    health,
    logEvent: health.runtimeStatus !== prevStatus,
  });

  const automation = await loadAutomationWithRelations(row.id);
  return { automation, health };
}

/**
 * Batch-refresh health for all deployed Hermes crons in a business.
 * Used by automations list sync so owners see run health without Cronalytics.
 */
export async function refreshBusinessAutomationHealth(input: {
  businessId: string;
  baseUrl: string;
  apiKey: string;
}): Promise<Map<string, AutomationRunHealth>> {
  const rows = await prisma.automation.findMany({
    where: {
      process: { businessId: input.businessId },
      externalId: { not: null },
      OR: [{ type: 'hermes_cron' }, { type: null }],
    },
    include: {
      process: {
        select: {
          id: true,
          name: true,
          businessId: true,
          business: { select: { userId: true } },
        },
      },
    },
  });

  let jobs: HermesJobSummary[] = [];
  try {
    jobs = await listHermesJobs(input.baseUrl, input.apiKey);
  } catch (error) {
    console.error('Failed to list Hermes jobs for health refresh', error);
  }

  const byId = new Map(jobs.map((j) => [j.id, j]));
  const result = new Map<string, AutomationRunHealth>();

  for (const row of rows) {
    if (!row.externalId) continue;
    try {
      let job = byId.get(row.externalId);
      if (!job) {
        try {
          job = await getHermesJob(input.baseUrl, input.apiKey, row.externalId);
        } catch {
          job = undefined;
        }
      }

      const health = job
        ? mergeHealthWithCronalytics(job)
        : buildRunHealthFromStatusOnly(row.externalId, row.status);

      await applyRuntimeStatus({
        automationId: row.id,
        processId: row.process.id,
        processName: row.process.name,
        businessId: row.process.businessId,
        ownerUserId: row.process.business.userId,
        health,
        logEvent: false,
      });

      result.set(row.process.id, health);
    } catch (error) {
      console.error(`Health refresh failed for automation ${row.id}`, error);
      result.set(
        row.process.id,
        buildRunHealthFromStatusOnly(row.externalId, row.status)
      );
    }
  }

  return result;
}
