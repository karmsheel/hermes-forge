import { prisma } from '@/lib/prisma';
import { serializeAutomation } from '@/lib/automation-access';
import { slugifyJobName } from '@/lib/automation-deploy';
import { mapHermesJobStatus as mapRuntimeStatus } from '@/lib/automation-run-health';
import { listHermesJobs, type HermesJobSummary } from '@/lib/hermes-jobs';
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
};

export function forgeJobNameForProcess(processName: string): string {
  return `forge-${slugifyJobName(processName)}`;
}

export function processNameSlug(processName: string): string {
  return slugifyJobName(processName);
}

function slugifyJobNameFromHermes(name: string): string {
  const withoutForge = name.startsWith('forge-') ? name.slice(6) : name;
  return slugifyJobName(withoutForge);
}

export type JobMatchTier = 'forge_exact' | 'slug_exact';

export interface MatchedHermesJob {
  job: HermesJobSummary;
  tier: JobMatchTier;
}

export function matchHermesJobToProcess(
  jobs: HermesJobSummary[],
  processName: string,
  claimedJobIds: Set<string>
): MatchedHermesJob | null {
  const forgeName = forgeJobNameForProcess(processName);
  const processSlug = processNameSlug(processName);

  let best: MatchedHermesJob | null = null;

  for (const job of jobs) {
    if (!job.id || claimedJobIds.has(job.id)) continue;
    const jobName = job.name?.trim();
    if (!jobName) continue;

    if (jobName === forgeName) {
      return { job, tier: 'forge_exact' };
    }

    if (slugifyJobNameFromHermes(jobName) === processSlug) {
      if (!best || best.tier !== 'forge_exact') {
        best = { job, tier: 'slug_exact' };
      }
    }
  }

  return best;
}

function mapHermesJobStatus(status?: string): string {
  return mapRuntimeStatus(status);
}

export interface SyncCronLinkInput {
  automationId: string;
  processName: string;
  jobs: HermesJobSummary[];
  claimedJobIds: Set<string>;
}

export interface SyncCronLinkResult {
  linked: boolean;
  jobId?: string;
  automation?: AutomationWithMessages;
}

export async function syncAutomationCronLink(
  input: SyncCronLinkInput
): Promise<SyncCronLinkResult> {
  const automation = await prisma.automation.findUnique({
    where: { id: input.automationId },
    include: automationInclude,
  });

  if (!automation) return { linked: false };
  if (automation.externalId) {
    return { linked: false, automation: serializeAutomation(automation) };
  }

  const match = matchHermesJobToProcess(input.jobs, input.processName, input.claimedJobIds);
  if (!match) return { linked: false, automation: serializeAutomation(automation) };

  const updated = await prisma.automation.update({
    where: { id: automation.id },
    data: {
      type: 'hermes_cron',
      status: mapHermesJobStatus(match.job.status),
      externalId: match.job.id,
      externalUrl: null,
      deployedAt: new Date(),
    },
    include: automationInclude,
  });

  return { linked: true, jobId: match.job.id, automation: serializeAutomation(updated) };
}

export async function listHermesJobsSafe(
  baseUrl: string,
  apiKey: string
): Promise<HermesJobSummary[]> {
  try {
    return await listHermesJobs(baseUrl, apiKey);
  } catch (error) {
    console.error('Failed to list Hermes jobs for sync', error);
    return [];
  }
}

export async function getClaimedJobIdsForBusiness(businessId: string): Promise<Set<string>> {
  const automations = await prisma.automation.findMany({
    where: {
      process: { businessId },
      externalId: { not: null },
    },
    select: { externalId: true },
  });

  return new Set(
    automations.map((a) => a.externalId).filter((id): id is string => Boolean(id))
  );
}

export async function syncProcessCronLink(
  processId: string,
  processName: string,
  baseUrl: string,
  apiKey: string,
  businessId: string
): Promise<SyncCronLinkResult> {
  const automation = await prisma.automation.findUnique({
    where: { processId },
    include: automationInclude,
  });

  if (!automation) return { linked: false };
  if (automation.externalId) {
    return { linked: false, automation: serializeAutomation(automation) };
  }

  const [jobs, claimedJobIds] = await Promise.all([
    listHermesJobsSafe(baseUrl, apiKey),
    getClaimedJobIdsForBusiness(businessId),
  ]);

  return syncAutomationCronLink({
    automationId: automation.id,
    processName,
    jobs,
    claimedJobIds,
  });
}

export async function findMatchingHermesJob(
  processName: string,
  jobs: HermesJobSummary[],
  claimedJobIds: Set<string>
): Promise<HermesJobSummary | null> {
  return matchHermesJobToProcess(jobs, processName, claimedJobIds)?.job ?? null;
}