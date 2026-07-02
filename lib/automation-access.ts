import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProcessAccess } from '@/lib/auth';
import { recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { AUTOMATION_WELCOME_MESSAGE } from '@/lib/automation-chat';
import {
  parseAutomationPlan,
  parseCredentialMap,
  parseIntegrations,
  type AutomationStudioData,
  type AutomationWithMessages,
} from '@/lib/automation-types';

export async function requireApprovedProcessAccess(request: NextRequest, processId: string) {
  const result = await requireProcessAccess(request, processId);
  if ('error' in result) return result;

  if (result.process.status !== 'approved') {
    return {
      error: NextResponse.json(
        { error: 'Process must be approved for automation before opening the studio' },
        { status: 403 }
      ),
    };
  }

  return result;
}

export async function getOrCreateAutomation(
  processId: string,
  logContext?: { userId?: string }
): Promise<AutomationWithMessages> {
  const existing = await prisma.automation.findUnique({
    where: { processId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (existing) return existing;

  const process = await prisma.process.findUnique({
    where: { id: processId },
    select: { businessId: true, name: true },
  });

  const automation = await prisma.automation.create({
    data: { processId, status: 'designing' },
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
    });
  }

  return prisma.automation.findUniqueOrThrow({
    where: { id: automation.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

export function buildAutomationStudioData(
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
  },
  automation: AutomationWithMessages
): AutomationStudioData {
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
  };
}