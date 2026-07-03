import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isUntitledProcessName, suggestProcessName } from '@/lib/naming';
import { requireProcessAccess } from '@/lib/auth';
import { recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const AgentSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
  conversationId: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Naming subagent — proposes a workflow name after the first user answers */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = AgentSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    if (!isUntitledProcessName(process.name)) {
      return NextResponse.json({ updated: false, name: process.name });
    }

    // 3.4: Filter messages to the active conversation
    const conversationId = body.conversationId || process.conversations?.[0]?.id || null;
    const conversationMessages = conversationId
      ? process.messages.filter((m) => m.conversationId === conversationId)
      : process.messages;

    const conversation = conversationMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMessageCount = conversation.filter((m) => m.role === 'user').length;
    if (userMessageCount < 1) {
      return NextResponse.json({ updated: false, reason: 'no_user_messages' });
    }

    const suggestedName = await suggestProcessName(
      { baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model },
      conversation
    );

    await prisma.process.update({
      where: { id },
      data: {
        name: suggestedName,
        nameStatus: 'pending',
      },
    });

    await recordBusinessEvent({
      businessId: process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_UPDATED,
      entityType: 'process',
      entityId: id,
      entityName: suggestedName,
      summary: `Suggested name "${suggestedName}" for workflow`,
      metadata: {
        changes: [{ field: 'name', before: process.name, after: suggestedName }],
      },
    });

    const confirmationMessage = `I've named this workflow **${suggestedName}** based on what you've shared — does that work, or would you like to call it something else?`;

    const lastMessage = process.messages[process.messages.length - 1];
    const alreadyAsked =
      lastMessage?.role === 'assistant' &&
      lastMessage.content.includes('named this workflow');

    if (!alreadyAsked) {
      await prisma.chatMessage.create({
        data: {
          processId: id,
          conversationId,
          role: 'assistant',
          content: confirmationMessage,
        },
      });
    }

    const updated = await prisma.process.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      updated: true,
      name: suggestedName,
      process: updated,
    });
  } catch (error) {
    console.error('Naming subagent error', error);
    const message = error instanceof Error ? error.message : 'Naming failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}