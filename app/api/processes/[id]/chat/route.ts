import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { callHermes } from '@/lib/hermes';
import { buildChatSystemPrompt } from '@/lib/diagram';
import { requireProcessAccess } from '@/lib/auth';
import { buildApprovalUpdate } from '@/lib/process-approve';
import {
  assistantAskedAccuracyQuestion,
  shouldPromptForAccuracy,
  userConfirmsAccuracy,
} from '@/lib/process-approval';

const ChatSchema = z
  .object({
    content: z.string().min(1).optional(),
    replyOnly: z.boolean().optional(),
    baseUrl: z.string(),
    apiKey: z.string(),
    model: z.string().optional(),
  })
  .refine((data) => data.replyOnly === true || !!data.content?.trim(), {
    message: 'content is required unless replyOnly is true',
  });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    const replyOnly = body.replyOnly === true;
    let allMessages = process.messages.map((m) => ({ role: m.role, content: m.content }));

    const priorMessages = allMessages;
    const lastAssistant = [...priorMessages].reverse().find((m) => m.role === 'assistant');

    let approvedFromChat = false;
    if (
      !replyOnly &&
      process.status !== 'approved' &&
      lastAssistant &&
      assistantAskedAccuracyQuestion(lastAssistant.content) &&
      userConfirmsAccuracy(body.content!)
    ) {
      approvedFromChat = true;
      await prisma.process.update({
        where: { id },
        data: buildApprovalUpdate('approved'),
      });
    }

    if (replyOnly) {
      const last = allMessages[allMessages.length - 1];
      if (!last || last.role !== 'user') {
        return NextResponse.json(
          { error: 'No user message to reply to' },
          { status: 400 }
        );
      }
    } else {
      const content = body.content!.trim();
      await prisma.chatMessage.create({
        data: { processId: id, role: 'user', content },
      });
      allMessages = [...allMessages, { role: 'user', content }];
    }

    const messageCount = allMessages.length;
    const hasDiagram = Boolean(process.diagramMermaid?.trim());
    const recentAccuracyAsk = priorMessages
      .slice(-4)
      .some((m) => m.role === 'assistant' && assistantAskedAccuracyQuestion(m.content));

    const assistantContent = await callHermes(
      { baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model },
      [
        {
          role: 'system',
          content: buildChatSystemPrompt({
            processName: process.name,
            description: process.description,
            nameStatus: process.nameStatus,
            status: approvedFromChat ? 'approved' : process.status,
            hasDiagram,
            shouldAskAccuracy:
              !approvedFromChat &&
              process.status !== 'approved' &&
              !recentAccuracyAsk &&
              shouldPromptForAccuracy({
                status: process.status,
                diagramMermaid: process.diagramMermaid,
                messageCount,
              }),
          }),
        },
        {
          role: 'system',
          content: `Current workflow: "${process.name}" — ${process.description || 'Not yet described'}`,
        },
        ...allMessages,
      ]
    );

    const assistantMessage = assistantContent || 'Thanks — tell me more about the next step.';

    await prisma.chatMessage.create({
      data: { processId: id, role: 'assistant', content: assistantMessage },
    });

    const lastUserContent =
      allMessages.filter((m) => m.role === 'user').at(-1)?.content ?? '';

    if (process.nameStatus === 'pending' && !/^untitled/i.test(process.name)) {
      const renameIntent = /rename|call it|instead|different name|change (the )?name/i.test(lastUserContent);
      if (renameIntent) {
        const match = lastUserContent.match(/(?:call it|rename (?:it )?(?:to )?|name it)\s+["']?([^"'\n.]+)/i);
        if (match?.[1]?.trim()) {
          await prisma.process.update({
            where: { id },
            data: { name: match[1].trim(), nameStatus: 'confirmed' },
          });
        }
      } else {
        await prisma.process.update({
          where: { id },
          data: { nameStatus: 'confirmed' },
        });
      }
    }

    const updated = await prisma.process.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      process: updated,
      runBackgroundAgents: true,
      approved: approvedFromChat,
    });
  } catch (error) {
    console.error('Process chat error', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}