import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { callHermes } from '@/lib/hermes';
import { buildChatSystemPrompt } from '@/lib/diagram';
import { requireProcessAccess } from '@/lib/auth';

const ChatSchema = z.object({
  content: z.string().min(1),
  baseUrl: z.string(),
  apiKey: z.string(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    await prisma.chatMessage.create({
      data: { processId: id, role: 'user', content: body.content },
    });

    const allMessages = [
      ...process.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: body.content },
    ];

    const assistantContent = await callHermes(
      { baseUrl: body.baseUrl, apiKey: body.apiKey },
      [
        {
          role: 'system',
          content: buildChatSystemPrompt({
            processName: process.name,
            description: process.description,
            nameStatus: process.nameStatus,
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

    // User replied after a pending auto-name — treat as acknowledged unless they asked to rename
    if (process.nameStatus === 'pending' && !/^untitled/i.test(process.name)) {
      const renameIntent = /rename|call it|instead|different name|change (the )?name/i.test(body.content);
      if (renameIntent) {
        const match = body.content.match(/(?:call it|rename (?:it )?(?:to )?|name it)\s+["']?([^"'\n.]+)/i);
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
    });
  } catch (error) {
    console.error('Process chat error', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}