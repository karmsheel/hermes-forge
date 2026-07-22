import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  streamAutomationChatTurn,
  parseAutomationPlan,
  parseIntegrations,
} from "@/lib/chatbar/automation-chat-turn";
import { normalizeRuntimeEvent } from "@/lib/chatbar/runtime-events";
import {
  getOrCreateAutomation,
  loadAutomationWithRelations,
  requireApprovedProcessAccess,
  buildAutomationStudioData,
} from "@/lib/automation-access";
import type { AutomationWithMessages } from "@/lib/automation-types";
import { syncProcessCronLink } from "@/lib/automation-sync";
import { liveOccurredNow, recordBusinessEvent, truncatePreview } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";

const ChatSchema = z.object({
  content: z.string().min(1),
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
  /** Prefer SSE (default true). */
  stream: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function sseEncode(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ("error" in result) return result.error;
    const process = result.process;

    const automation = await getOrCreateAutomation(id, {
      userId: result.session.userId,
    });

    await prisma.automationMessage.create({
      data: {
        automationId: automation.id,
        role: "user",
        content: body.content,
      },
    });

    await recordBusinessEvent({
      businessId: process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE,
      entityType: "chat",
      entityId: id,
      entityName: process.name,
      summary: `Automation message in "${process.name}"`,
      metadata: { preview: truncatePreview(body.content), role: "user" },
      ...liveOccurredNow(),
    });

    const allMessages = [
      ...automation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: body.content },
    ];

    const hermes = {
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
    };

    const turnInput = {
      process: {
        id: process.id,
        businessId: process.businessId,
        name: process.name,
        description: process.description,
        department: process.department,
        trigger: process.trigger,
        inputs: process.inputs,
        outputs: process.outputs,
        manualSteps: process.manualSteps,
        diagramMermaid: process.diagramMermaid,
      },
      automationId: automation.id,
      userId: result.session.userId,
      messages: allMessages,
      hermes,
      existingPlan: parseAutomationPlan(automation.planJson),
      existingIntegrations: parseIntegrations(automation.integrationsJson),
      assignedAgentName: automation.hermesAgentProfile?.displayName ?? null,
      agentProfileKey: automation.hermesAgentProfile?.profileKey ?? null,
    };

    const finishTurn = async (assistantContent: string) => {
      await prisma.automationMessage.create({
        data: {
          automationId: automation.id,
          role: "assistant",
          content: assistantContent,
        },
      });

      let updatedAutomation: AutomationWithMessages =
        await loadAutomationWithRelations(automation.id);

      const syncResult = await syncProcessCronLink(
        id,
        process.name,
        body.baseUrl,
        body.apiKey,
        process.businessId,
      );
      if (syncResult.automation) {
        updatedAutomation = syncResult.automation;
      }

      const studio = await buildAutomationStudioData(process, updatedAutomation);
      return {
        studio,
        runExtraction: true as const,
        cronLinked: syncResult.linked,
      };
    };

    const preferStream = body.stream !== false;

    if (!preferStream) {
      let assistantContent =
        "Tell me more about which steps you want to automate first.";
      for await (const event of streamAutomationChatTurn(turnInput)) {
        if (event.type === "done") assistantContent = event.assistantContent;
      }
      const resultPayload = await finishTurn(assistantContent);
      return NextResponse.json({
        ...resultPayload.studio,
        runExtraction: true,
        cronLinked: resultPayload.cronLinked,
      });
    }

    const hermesAbort = new AbortController();
    request.signal.addEventListener("abort", () => hermesAbort.abort(), {
      once: true,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(sseEncode(event, data));
          } catch {
            /* client gone */
          }
        };

        try {
          for await (const event of streamAutomationChatTurn({
            ...turnInput,
            signal: hermesAbort.signal,
          })) {
            if (hermesAbort.signal.aborted) break;
            if (event.type === "run") {
              send("run_id", { runId: event.runId });
              continue;
            }
            if (event.type === "tool") {
              const normalized = normalizeRuntimeEvent(event.event);
              send("tool", { ...normalized, event: event.event });
              send("tool_activity", { ...normalized, event: event.event });
              continue;
            }
            if (event.type === "usage") {
              send("usage", event.usage);
              continue;
            }
            if (event.type === "delta") {
              send("delta", { text: event.text });
              continue;
            }
            if (event.type === "done") {
              const finished = await finishTurn(event.assistantContent);
              send("done", {
                ...finished.studio,
                runExtraction: true,
                cronLinked: finished.cronLinked,
                message: {
                  role: "assistant",
                  content: event.assistantContent,
                },
                usage: event.usage,
                runId: event.runId,
                processId: id,
                kind: "automation",
              });
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Chat failed";
          send("error", { error: message });
        } finally {
          try {
            controller.close();
          } catch {
            /* closed */
          }
        }
      },
      cancel() {
        hermesAbort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Automation chat error", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
