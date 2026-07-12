/** Canonical process lifecycle (4.12 HITL). */
export const PROCESS_STATUSES = ['draft', 'refined', 'forged'] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

/** Legacy values still accepted on read / write for one release. */
const LEGACY_STATUS_MAP: Record<string, ProcessStatus> = {
  mapping: 'draft',
  discovered: 'draft',
  reviewed: 'refined',
  approved: 'forged',
  draft: 'draft',
  refined: 'refined',
  forged: 'forged',
};

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  draft: 'Draft',
  refined: 'Refined',
  forged: 'Forged',
};

/** Sprint 1 placeholder until Automation model ships in Sprint 2 */
export const AUTOMATION_DEPLOY_STATUSES = [
  'not_started',
  'designing',
  'ready_to_deploy',
  'deployed_cron',
  'deployed_n8n',
  'needs_credentials',
] as const;

export type AutomationDeployStatus = (typeof AUTOMATION_DEPLOY_STATUSES)[number];

export const AUTOMATION_DEPLOY_LABELS: Record<AutomationDeployStatus, string> = {
  not_started: 'Ready to design',
  designing: 'Designing',
  ready_to_deploy: 'Ready to deploy',
  deployed_cron: 'Hermes cron',
  deployed_n8n: 'n8n workflow',
  needs_credentials: 'Needs credentials',
};

export function normalizeProcessStatus(value: string): ProcessStatus {
  return LEGACY_STATUS_MAP[value] ?? 'draft';
}

export function isProcessStatus(value: string): value is ProcessStatus {
  return value in LEGACY_STATUS_MAP || (PROCESS_STATUSES as readonly string[]).includes(value);
}

/** True when process is forged/live (agent writes need approval). */
export function isProcessForged(status: string): boolean {
  return normalizeProcessStatus(status) === 'forged';
}

/** Can human forge (lock) this process for automation / business truth. */
export function canForgeProcess(process: {
  status: string;
  diagramMermaid: string | null;
}): boolean {
  return !isProcessForged(process.status) && Boolean(process.diagramMermaid?.trim());
}

/** @deprecated use canForgeProcess — kept for call sites during migration */
export function canApproveForAutomation(process: {
  status: string;
  diagramMermaid: string | null;
}): boolean {
  return canForgeProcess(process);
}
