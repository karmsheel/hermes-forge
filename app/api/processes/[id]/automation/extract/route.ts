import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { extractAutomationPlan } from '@/lib/automation-extract';
import type { AutomationWithMessages } from '@/lib/automation-types';
import {
  buildAutomationStudioData,
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';
import { syncProcessCronLink } from '@/lib/automation-sync';
import { recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const AgentSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Background subagent — extracts plan + integrations from automation chat */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = AgentSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    const automation = await getOrCreateAutomation(id, { userId: result.session.userId });
    const userMessageCount = automation.messages.filter((m) => m.role === 'user').length;
    if (userMessageCount < 1) {
      return NextResponse.json({ updated: false, reason: 'no_user_messages' });
    }

    const extraction = await extractAutomationPlan(
      { baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model },
      {
        processName: process.name,
        description: process.description,
        trigger: process.trigger,
        manualSteps: process.manualSteps,
        diagramMermaid: process.diagramMermaid,
        conversation: automation.messages.map((m) => ({ role: m.role, content: m.content })),
      }
    );

    const updateData: {
      planJson: string;
      integrationsJson: string;
      status?: string;
    } = {
      planJson: JSON.stringify(extraction.plan),
      integrationsJson: JSON.stringify(extraction.integrations),
    };
    if (!automation.externalId) {
      updateData.status = extraction.planReady ? 'ready_to_deploy' : 'designing';
    }

    let updatedAutomation: AutomationWithMessages = await prisma.automation.update({
      where: { id: automation.id },
      data: updateData,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    const syncResult = await syncProcessCronLink(
      id,
      process.name,
      body.baseUrl,
      body.apiKey,
      process.businessId
    );
    if (syncResult.automation) {
      updatedAutomation = syncResult.automation;
    }

    await recordBusinessEvent({
      businessId: process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.AUTOMATION_PLAN_EXTRACTED,
      entityType: 'automation',
      entityId: id,
      entityName: process.name,
      summary: `Extracted automation plan for "${process.name}"`,
      metadata: {
        status: updatedAutomation.status,
        planReady: extraction.planReady,
      },
    });

    if (syncResult.linked) {
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.AUTOMATION_SYNCED,
        entityType: 'automation',
        entityId: id,
        entityName: process.name,
        summary: `Synced Hermes cron for "${process.name}"`,
      });
    }

    return NextResponse.json({
      updated: true,
      planReady: extraction.planReady,
      cronLinked: syncResult.linked,
      studio: buildAutomationStudioData(process, updatedAutomation),
    });
  } catch (error) {
    console.error('Automation extract error', error);
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}