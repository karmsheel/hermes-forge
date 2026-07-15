import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProcessAccess } from '@/lib/auth';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { AUTOMATION_WELCOME_MESSAGE } from '@/lib/automation-chat';
import {
  parseAutomationPlan,
  parseCredentialMap,
  parseIntegrations,
  type AutomationAgentSummary,
  type AutomationStudioData,
  type AutomationWithMessages,
} from '@/lib/automation-types';

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

export function toAgentSummary(
  agent: {
    id: string;
    displayName: string;
    profileKey: string;
    description: string | null;
    model: string | null;
    isHired: boolean;
    isDefault: boolean;
    iconKey: string | null;
  } | null
    | undefined
): AutomationAgentSummary | null {
  if (!agent) return null;
  return {
    id: agent.id,
    displayName: agent.displayName,
    profileKey: agent.profileKey,
    description: agent.description,
    model: agent.model,
    isHired: agent.isHired,
    isDefault: agent.isDefault,
    iconKey: agent.iconKey,
  };
}

export async function requireApprovedProcessAccess(request: NextRequest, processId: string) {
  const result = await requireProcessAccess(request, processId);
  if ('error' in result) return result;

  const { isProcessForged } = await import('@/lib/process-status');
  if (!isProcessForged(result.process.status)) {
    return {
      error: NextResponse.json(
        { error: 'Process must be forged (approved) for automation before opening the studio' },
        { status: 403 }
      ),
    };
  }

  return result;
}

export async function getOrCreateAutomation(
  processId: string,
  logContext?: { userId?: string; businessId?: string }
): Promise<AutomationWithMessages> {
  const existing = await prisma.automation.findUnique({
    where: { processId },
    include: automationInclude,
  });

  if (existing) {
    return serializeAutomation(existing);
  }

  const process = await prisma.process.findUnique({
    where: { id: processId },
    select: { businessId: true, name: true },
  });

  const businessId = logContext?.businessId ?? process?.businessId;

  // Prefer default hired agent, else sole hired agent, as initial assignment.
  let defaultAgentId: string | null = null;
  if (businessId) {
    const hired = await prisma.hermesAgentProfile.findMany({
      where: { businessId, isHired: true },
      orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }],
      select: { id: true, isDefault: true },
    });
    if (hired.length === 1) {
      defaultAgentId = hired[0].id;
    } else if (hired.length > 1) {
      defaultAgentId = hired.find((a) => a.isDefault)?.id ?? hired[0].id;
    }
  }

  const automation = await prisma.automation.create({
    data: {
      processId,
      status: 'designing',
      hermesAgentProfileId: defaultAgentId,
    },
  });

  await prisma.automationMessage.create({
    data: {
      automationId: automation.id,
      role: 'assistant',
      content: AUTOMATION_WELCOME_MESSAGE,
    },
  });

  if (process) {
    await recordBusinessEvent({
      businessId: process.businessId,
      userId: logContext?.userId,
      type: BUSINESS_EVENT_TYPES.AUTOMATION_STUDIO_OPENED,
      entityType: 'automation',
      entityId: processId,
      entityName: process.name,
      summary: `Opened automation studio for "${process.name}"`,
      ...liveOccurredNow(),
    });

    if (defaultAgentId) {
      const agent = await prisma.hermesAgentProfile.findUnique({
        where: { id: defaultAgentId },
        select: { displayName: true },
      });
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: logContext?.userId,
        type: BUSINESS_EVENT_TYPES.AUTOMATION_AGENT_ASSIGNED,
        entityType: 'automation',
        entityId: processId,
        entityName: process.name,
        summary: `Assigned agent "${agent?.displayName ?? 'agent'}" to automation for "${process.name}"`,
        metadata: { agentId: defaultAgentId },
        ...liveOccurredNow(),
      });
    }
  }

  const created = await prisma.automation.findUniqueOrThrow({
    where: { id: automation.id },
    include: automationInclude,
  });
  return serializeAutomation(created);
}

type AutomationRowWithRelations = {
  id: string;
  processId: string;
  type: string | null;
  status: string;
  planJson: string | null;
  integrationsJson: string | null;
  credentialMapJson: string | null;
  externalId: string | null;
  externalUrl: string | null;
  deployedAt: Date | null;
  hermesAgentProfileId: string | null;
  ingestToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: { id: string; automationId: string; role: string; content: string; createdAt: Date }[];
  hermesAgentProfile?: {
    id: string;
    displayName: string;
    profileKey: string;
    description: string | null;
    model: string | null;
    isHired: boolean;
    isDefault: boolean;
    iconKey: string | null;
  } | null;
};

export function serializeAutomation(row: AutomationRowWithRelations): AutomationWithMessages {
  const agent = toAgentSummary(row.hermesAgentProfile);
  return {
    id: row.id,
    processId: row.processId,
    type: row.type,
    status: row.status,
    planJson: row.planJson,
    integrationsJson: row.integrationsJson,
    credentialMapJson: row.credentialMapJson,
    externalId: row.externalId,
    externalUrl: row.externalUrl,
    deployedAt: row.deployedAt,
    hermesAgentProfileId: row.hermesAgentProfileId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hermesAgentProfile: agent,
    hasIngestToken: Boolean(row.ingestToken),
    messages: row.messages,
  };
}

/** Reload automation with messages + agent for studio responses. */
export async function loadAutomationWithRelations(
  automationId: string
): Promise<AutomationWithMessages> {
  const row = await prisma.automation.findUniqueOrThrow({
    where: { id: automationId },
    include: automationInclude,
  });
  return serializeAutomation(row);
}

export async function listHiredAgentsForBusiness(
  businessId: string
): Promise<AutomationAgentSummary[]> {
  const hired = await prisma.hermesAgentProfile.findMany({
    where: { businessId, isHired: true },
    orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }],
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
  });
  return hired.map((a) => toAgentSummary(a)!);
}

/**
 * Assign (or clear) the hired Hermes agent that owns this automation.
 * Agent must be hired and belong to the same business as the process.
 */
export async function assignAutomationAgent(input: {
  processId: string;
  businessId: string;
  processName: string;
  userId?: string;
  hermesAgentProfileId: string | null;
}): Promise<AutomationWithMessages> {
  const automation = await getOrCreateAutomation(input.processId, {
    userId: input.userId,
    businessId: input.businessId,
  });

  let agentId: string | null = input.hermesAgentProfileId;
  let agentName: string | null = null;

  if (agentId) {
    const agent = await prisma.hermesAgentProfile.findFirst({
      where: {
        id: agentId,
        businessId: input.businessId,
        isHired: true,
      },
      select: {
        id: true,
        displayName: true,
      },
    });
    if (!agent) {
      throw new Error('Agent not found, not hired, or belongs to another business');
    }
    agentId = agent.id;
    agentName = agent.displayName;
  }

  if (automation.hermesAgentProfileId === agentId) {
    const current = await prisma.automation.findUniqueOrThrow({
      where: { id: automation.id },
      include: automationInclude,
    });
    return serializeAutomation(current);
  }

  const updated = await prisma.automation.update({
    where: { id: automation.id },
    data: { hermesAgentProfileId: agentId },
    include: automationInclude,
  });

  await recordBusinessEvent({
    businessId: input.businessId,
    userId: input.userId,
    type: BUSINESS_EVENT_TYPES.AUTOMATION_AGENT_ASSIGNED,
    entityType: 'automation',
    entityId: input.processId,
    entityName: input.processName,
    summary: agentId
      ? `Assigned agent "${agentName}" to automation for "${input.processName}"`
      : `Cleared agent assignment on automation for "${input.processName}"`,
    metadata: {
      agentId: agentId ?? undefined,
      previousAgentId: automation.hermesAgentProfileId ?? undefined,
    },
    ...liveOccurredNow(),
  });

  return serializeAutomation(updated);
}

export async function buildAutomationStudioData(
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
    approvedAt: Date | null;
    status: string;
    businessId: string;
  },
  automation: AutomationWithMessages
): Promise<AutomationStudioData> {
  const hiredAgents = await listHiredAgentsForBusiness(process.businessId);
  const assignedAgent =
    automation.hermesAgentProfile ??
    hiredAgents.find((a) => a.id === automation.hermesAgentProfileId) ??
    null;

  return {
    process: {
      id: process.id,
      name: process.name,
      description: process.description,
      department: process.department,
      trigger: process.trigger,
      inputs: process.inputs,
      outputs: process.outputs,
      manualSteps: process.manualSteps,
      diagramMermaid: process.diagramMermaid,
      approvedAt: process.approvedAt?.toISOString() ?? null,
      status: process.status,
    },
    automation,
    plan: parseAutomationPlan(automation.planJson),
    integrations: parseIntegrations(automation.integrationsJson),
    credentialMap: parseCredentialMap(automation.credentialMapJson),
    hiredAgents,
    assignedAgent,
  };
}
