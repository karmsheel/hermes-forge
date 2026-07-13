import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireProcessAccess } from '@/lib/auth';
import { defaultForkTitle, messagesToCopyForFork } from '@/lib/conversation-fork';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    const conversations = await prisma.conversation.findMany({
      where: { processId: id, kind: 'process' },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('List conversations error', error);
    return NextResponse.json({ error: 'Failed to list conversations' }, { status: 500 });
  }
}

const ForkSchema = z.object({
  forkFromConversationId: z.string(),
  forkAtMessageId: z.string().optional(),
  title: z.string().max(120).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    const body = ForkSchema.parse(await request.json());

    // Verify source conversation exists and belongs to this process
    const sourceConversation = await prisma.conversation.findFirst({
      where: {
        id: body.forkFromConversationId,
        processId: id,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!sourceConversation) {
      return NextResponse.json(
        { error: 'Source conversation not found' },
        { status: 404 }
      );
    }

    const messagesToCopy = messagesToCopyForFork(
      sourceConversation.messages,
      body.forkAtMessageId,
    );

    // Create new conversation + copy messages in a transaction
    const title =
      body.title?.trim() ||
      defaultForkTitle(sourceConversation.title, Boolean(body.forkAtMessageId));

    const businessId = result.process.businessId;

    const newConversation = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          businessId,
          processId: id,
          kind: 'process',
          title,
          forkedFromId: body.forkFromConversationId,
        },
      });

      // Copy messages to the new conversation
      if (messagesToCopy.length > 0) {
        await tx.chatMessage.createMany({
          data: messagesToCopy.map((m) => ({
            processId: id,
            conversationId: conv.id,
            role: m.role,
            content: m.content,
          })),
        });
      }

      return conv;
    });

    // Return with message count
    const result2 = await prisma.conversation.findUnique({
      where: { id: newConversation.id },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(result2);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Fork conversation error', error);
    return NextResponse.json({ error: 'Failed to fork conversation' }, { status: 500 });
  }
}
