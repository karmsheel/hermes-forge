import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { callHermes } from '@/lib/hermes';
import { buildAutomationChatSystemPrompt } from '@/lib/automation-chat';
import {
  getOrCreateAutomation,
  requireApprovedProcessAccess,
  buildAutomationStudioData,
} from '@/lib/automation-access';
import { parseAutomationPlan, parseIntegrations } from '@/lib/automation-types';

const ChatSchema = z.object({
  content: z.string().min(1),
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    const automation = await getOrCreateAutomation(id);

    await prisma.automationMessage.create({
      data: { automationId: automation.id, role: 'user', content: body.content },
    });

    const allMessages = [
      ...automation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: body.content },
    ];

    const assistantContent = await callHermes(
      { baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model },
      [
        {
          role: 'system',
          content: buildAutomationChatSystemPrompt({
            processName: process.name,
            description: process.description,
            department: process.department,
            trigger: process.trigger,
            inputs: process.inputs,
            outputs: process.outputs,
            manualSteps: process.manualSteps,
            diagramMermaid: process.diagramMermaid,
            existingPlan: parseAutomationPlan(automation.planJson),
            existingIntegrations: parseIntegrations(automation.integrationsJson),
          }),
        },
        {
          role: 'system',
          content: `Process map: "${process.name}" — ${process.description || 'No description'}`,
        },
        ...allMessages,
      ]
    );

    const assistantMessage =
      assistantContent || 'Tell me more about which steps you want to automate first.';

    await prisma.automationMessage.create({
      data: { automationId: automation.id, role: 'assistant', content: assistantMessage },
    });

    const updatedAutomation = await prisma.automation.findUniqueOrThrow({
      where: { id: automation.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      ...buildAutomationStudioData(process, updatedAutomation),
      runExtraction: true,
    });
  } catch (error) {
    console.error('Automation chat error', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}