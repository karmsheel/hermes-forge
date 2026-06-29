import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { callHermes } from '@/lib/hermes';
import { generateDiagramMermaid, PROCESS_CHAT_SYSTEM_PROMPT } from '@/lib/diagram';

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

    const process = await prisma.process.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

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
        { role: 'system', content: PROCESS_CHAT_SYSTEM_PROMPT },
        {
          role: 'system',
          content: `Current process: "${process.name}" — ${process.description || 'No description yet'}`,
        },
        ...allMessages,
      ]
    );

    const assistantMessage = assistantContent || 'Thanks — tell me more about the next step.';

    await prisma.chatMessage.create({
      data: { processId: id, role: 'assistant', content: assistantMessage },
    });

    let diagramMermaid = process.diagramMermaid;
    let diagramError: string | null = null;

    try {
      const updatedDiagram = await generateDiagramMermaid(
        { baseUrl: body.baseUrl, apiKey: body.apiKey },
        process.name,
        process.description,
        [
          ...allMessages,
          { role: 'assistant', content: assistantMessage },
        ],
        process.diagramMermaid
      );

      if (updatedDiagram) {
        diagramMermaid = updatedDiagram;
        await prisma.process.update({
          where: { id },
          data: {
            diagramMermaid: updatedDiagram,
            diagramUpdatedAt: new Date(),
          },
        });
      }
    } catch (err) {
      diagramError = err instanceof Error ? err.message : 'Diagram update failed';
      console.warn('Diagram generation failed', err);
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
      diagramMermaid,
      diagramError,
    });
  } catch (error) {
    console.error('Process chat error', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}