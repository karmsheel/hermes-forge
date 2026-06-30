export const PROCESS_STATUSES = ['mapping', 'reviewed', 'approved'] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  mapping: 'Mapping',
  reviewed: 'Reviewed',
  approved: 'Approved',
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

export function isProcessStatus(value: string): value is ProcessStatus {
  return (PROCESS_STATUSES as readonly string[]).includes(value);
}

export function canApproveForAutomation(process: {
  status: string;
  diagramMermaid: string | null;
}): boolean {
  return process.status !== 'approved' && Boolean(process.diagramMermaid?.trim());
}