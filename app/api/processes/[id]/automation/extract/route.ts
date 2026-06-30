import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { extractAutomationPlan } from '@/lib/automation-extract';
import {
  buildAutomationStudioData,
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';

const AgentSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
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

    const automation = await getOrCreateAutomation(id);
    const userMessageCount = automation.messages.filter((m) => m.role === 'user').length;
    if (userMessageCount < 1) {
      return NextResponse.json({ updated: false, reason: 'no_user_messages' });
    }

    const extraction = await extractAutomationPlan(
      { baseUrl: body.baseUrl, apiKey: body.apiKey },
      {
        processName: process.name,
        description: process.description,
        trigger: process.trigger,
        manualSteps: process.manualSteps,
        diagramMermaid: process.diagramMermaid,
        conversation: automation.messages.map((m) => ({ role: m.role, content: m.content })),
      }
    );

    const updatedAutomation = await prisma.automation.update({
      where: { id: automation.id },
      data: {
        planJson: JSON.stringify(extraction.plan),
        integrationsJson: JSON.stringify(extraction.integrations),
        status: extraction.planReady ? 'ready_to_deploy' : 'designing',
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      updated: true,
      planReady: extraction.planReady,
      studio: buildAutomationStudioData(process, updatedAutomation),
    });
  } catch (error) {
    console.error('Automation extract error', error);
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}