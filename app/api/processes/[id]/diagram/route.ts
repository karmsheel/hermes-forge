import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateDiagramMermaid } from '@/lib/diagram';
import { requireProcessAccess } from '@/lib/auth';

const AgentSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Diagram subagent — runs in the background after each chat turn */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = AgentSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    const conversation = process.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const updatedDiagram = await generateDiagramMermaid(
      { baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model },
      process.name,
      process.description,
      conversation,
      process.diagramMermaid
    );

    if (updatedDiagram) {
      await prisma.process.update({
        where: { id },
        data: {
          diagramMermaid: updatedDiagram,
          diagramUpdatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      diagramMermaid: updatedDiagram,
    });
  } catch (error) {
    console.error('Diagram subagent error', error);
    const message = error instanceof Error ? error.message : 'Diagram update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}