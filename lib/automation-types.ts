import type { AutomationDeployStatus } from './process-status';

export type AutomationRecordStatus =
  | 'designing'
  | 'ready_to_deploy'
  | 'deployed'
  | 'needs_credentials'
  | 'active'
  | 'paused'
  | 'failed';

export type AutomationType = 'hermes_cron' | 'n8n_workflow';

export type RecommendedPath = 'hermes_cron' | 'n8n_workflow' | 'undecided';

export interface IntegrationRequirement {
  name: string;
  purpose: string;
  status: 'needed' | 'configured' | 'unknown';
}

export interface CredentialBinding {
  id: string;
  name: string;
  type?: string;
}

export type CredentialMap = Record<string, CredentialBinding>;

export interface AutomationPlan {
  summary: string;
  recommendedPath: RecommendedPath;
  triggerType: 'schedule' | 'webhook' | 'manual' | 'event' | 'undecided';
  schedule?: string | null;
  deliveryChannel?: string | null;
  automatableSteps: string[];
  manualSteps: string[];
  reasoning?: string;
}

export interface AutomationExtraction {
  integrations: IntegrationRequirement[];
  plan: AutomationPlan;
  planReady: boolean;
}

export interface AutomationMessage {
  id: string;
  automationId: string;
  role: string;
  content: string;
  createdAt: string | Date;
}

/** Hired agent summary attached to an automation (4.10 bind). */
export interface AutomationAgentSummary {
  id: string;
  displayName: string;
  profileKey: string;
  description: string | null;
  model: string | null;
  isHired: boolean;
  isDefault: boolean;
  iconKey: string | null;
}

export interface Automation {
  id: string;
  processId: string;
  type: AutomationType | string | null;
  status: AutomationRecordStatus | string;
  planJson: string | null;
  integrationsJson: string | null;
  credentialMapJson: string | null;
  externalId: string | null;
  externalUrl: string | null;
  deployedAt: string | Date | null;
  hermesAgentProfileId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Present when loaded with agent relation. */
  hermesAgentProfile?: AutomationAgentSummary | null;
  /** True when Hermes can POST drafts via /api/content/ingest (token never exposed). */
  hasIngestToken?: boolean;
}

export interface AutomationWithMessages extends Automation {
  messages: AutomationMessage[];
}

export interface AutomationStudioData {
  process: {
    id: string;
    name: string;
    description: string;
    department: string;
    trigger: string | null;
    inputs: string | null;
    outputs: string | null;
    manualSteps: string | null;
    diagramMermaid: string | null;
    approvedAt: string | null;
    status: string;
  };
  automation: AutomationWithMessages;
  plan: AutomationPlan | null;
  integrations: IntegrationRequirement[];
  credentialMap: CredentialMap;
  /** Hired agents available for assignment in this business. */
  hiredAgents: AutomationAgentSummary[];
  /** Currently assigned agent (resolved from automation.hermesAgentProfileId). */
  assignedAgent: AutomationAgentSummary | null;
}

export function parseAutomationPlan(planJson: string | null): AutomationPlan | null {
  if (!planJson) return null;
  try {
    return JSON.parse(planJson) as AutomationPlan;
  } catch {
    return null;
  }
}

export function parseCredentialMap(credentialMapJson: string | null): CredentialMap {
  if (!credentialMapJson) return {};
  try {
    const parsed = JSON.parse(credentialMapJson) as CredentialMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function parseIntegrations(integrationsJson: string | null): IntegrationRequirement[] {
  if (!integrationsJson) return [];
  try {
    const parsed = JSON.parse(integrationsJson) as IntegrationRequirement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function automationStatusToDeployStatus(
  automation: { status: string; type: string | null; externalId?: string | null } | null
): AutomationDeployStatus {
  if (!automation) return 'not_started';

  if (!automation.externalId) {
    if (automation.status === 'ready_to_deploy') return 'ready_to_deploy';
    if (automation.status === 'designing') return 'designing';
    return 'not_started';
  }

  if (automation.status === 'needs_credentials') return 'needs_credentials';

  return automation.type === 'n8n_workflow' ? 'deployed_n8n' : 'deployed_cron';
}

/** True when automation has been deployed externally (blocks process unforge). */
export function isAutomationLiveDeployed(
  automation: { externalId?: string | null } | null | undefined
): boolean {
  return Boolean(automation?.externalId?.trim());
}