import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateDiagramMermaid } from '@/lib/diagram';
import { encodeDiagramSse, streamDiagramMermaid } from '@/lib/diagram-stream';
import { requireProcessAccess } from '@/lib/auth';
import { recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const AgentSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function wantsStream(request: NextRequest, body: { stream?: boolean }): boolean {
  if (body.stream === true) return true;
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('text/event-stream');
}

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

    const diagramInput = {
      processName: process.name,
      processDescription: process.description,
      conversation,
      currentDiagram: process.diagramMermaid,
    };

    const hermesConfig = {
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
    };

    if (wantsStream(request, body)) {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();

          try {
            for await (const event of streamDiagramMermaid(hermesConfig, diagramInput)) {
              controller.enqueue(encoder.encode(encodeDiagramSse(event)));

              if (event.type === 'done') {
                await prisma.process.update({
                  where: { id },
                  data: {
                    diagramMermaid: event.mermaid,
                    diagramUpdatedAt: new Date(),
                  },
                });
                await recordBusinessEvent({
                  businessId: process.businessId,
                  userId: result.session.userId,
                  type: BUSINESS_EVENT_TYPES.PROCESS_DIAGRAM_UPDATED,
                  entityType: 'process',
                  entityId: id,
                  entityName: process.name,
                  summary: `Updated diagram for "${process.name}"`,
                });
              }

              if (event.type === 'error') {
                break;
              }
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Diagram stream failed';
            controller.enqueue(
              encoder.encode(
                encodeDiagramSse({ type: 'error', error: message })
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const updatedDiagram = await generateDiagramMermaid(
      hermesConfig,
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
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_DIAGRAM_UPDATED,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Updated diagram for "${process.name}"`,
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