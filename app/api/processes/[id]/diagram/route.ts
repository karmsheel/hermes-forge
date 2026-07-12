import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateDiagramMermaid } from '@/lib/diagram';
import { pickDiscoveryFields } from '@/lib/process-discovery';
import { encodeDiagramSse, streamDiagramMermaid } from '@/lib/diagram-stream';
import { requireProcessAccess } from '@/lib/auth';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { proposeForgedDiagramChange } from '@/lib/decisions/propose';
import { isProcessForged } from '@/lib/process-status';
import { loadPersonnelRoster } from '@/lib/personnel/load-roster';

const AgentSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
  conversationId: z.string().optional(),
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

    // 3.4: Filter messages to the active conversation
    const conversationId = body.conversationId || process.conversations?.[0]?.id || null;
    const conversationMessages = conversationId
      ? process.messages.filter((m) => m.conversationId === conversationId)
      : process.messages;

    const conversation = conversationMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 4.10 — roster for actors + swimlane lanes
    const personnel = await loadPersonnelRoster(process.businessId);

    const diagramInput = {
      processName: process.name,
      processDescription: process.description,
      conversation,
      currentDiagram: process.diagramMermaid,
      discovery: pickDiscoveryFields(process),
      personnel,
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
                if (isProcessForged(process.status)) {
                  const decision = await proposeForgedDiagramChange({
                    businessId: process.businessId,
                    userId: result.session.userId,
                    processId: id,
                    processName: process.name,
                    processStatus: process.status,
                    proposedDiagram: event.mermaid,
                    conversationId,
                  });
                  controller.enqueue(
                    encoder.encode(
                      encodeDiagramSse({
                        type: 'decision_pending',
                        decisionId: decision?.id ?? null,
                        message:
                          'Process is forged — diagram change sent for your approval in Decisions.',
                        mermaid: event.mermaid,
                      })
                    )
                  );
                } else {
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
                    ...liveOccurredNow(),
                  });
                }
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

    const updatedDiagram = await generateDiagramMermaid(hermesConfig, diagramInput);

    if (updatedDiagram && isProcessForged(process.status)) {
      const decision = await proposeForgedDiagramChange({
        businessId: process.businessId,
        userId: result.session.userId,
        processId: id,
        processName: process.name,
        processStatus: process.status,
        proposedDiagram: updatedDiagram,
        conversationId,
      });
      return NextResponse.json({
        success: true,
        applied: false,
        decisionPending: true,
        decisionId: decision?.id ?? null,
        message:
          'Process is forged — diagram change sent for your approval in Decisions.',
        diagramMermaid: process.diagramMermaid,
        proposedDiagramMermaid: updatedDiagram,
      });
    }

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
        ...liveOccurredNow(),
      });
    }

    return NextResponse.json({
      success: true,
      applied: true,
      diagramMermaid: updatedDiagram,
    });
  } catch (error) {
    console.error('Diagram subagent error', error);
    const message = error instanceof Error ? error.message : 'Diagram update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}