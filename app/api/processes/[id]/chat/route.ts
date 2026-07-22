import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProcessAccess } from "@/lib/auth";
import {
  assistantAskedAccuracyQuestion,
  userConfirmsAccuracy,
} from "@/lib/process-approval";
import {
  executeProcessSplit,
  shouldExecuteSplit,
} from "@/lib/process-split";
import { liveOccurredNow, recordBusinessEvent, truncatePreview } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import { buildNodeCommentPrefix } from "@/lib/node-comment";
import { streamProcessChatTurn } from "@/lib/chatbar/process-chat-turn";
import { normalizeRuntimeEvent } from "@/lib/chatbar/runtime-events";

const ChatSchema = z
  .object({
    content: z.string().min(1).optional(),
    replyOnly: z.boolean().optional(),
    conversationId: z.string().optional(),
    baseUrl: z.string(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    /** Prefer SSE streaming (default true). Set false for legacy JSON clients. */
    stream: z.boolean().optional(),
    nodeContext: z
      .object({
        nodeId: z.string().optional(),
        label: z.string(),
      })
      .optional(),
  })
  .refine((data) => data.replyOnly === true || !!data.content?.trim(), {
    message: "content is required unless replyOnly is true",
  });

type RouteContext = { params: Promise<{ id: string }> };

function sseEncode(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

const processInclude = {
  messages: { orderBy: { createdAt: "asc" as const } },
  conversations: { orderBy: { createdAt: "asc" as const } },
  business: { select: { id: true, name: true } },
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ("error" in result) return result.error;
    const process = result.process;

    const conversationId =
      body.conversationId || process.conversations?.[0]?.id || null;
    const conversationMessages = conversationId
      ? process.messages.filter(
          (m: (typeof process.messages)[0]) =>
            m.conversationId === conversationId,
        )
      : process.messages;

    const replyOnly = body.replyOnly === true;
    let allMessages = conversationMessages.map(
      (m: (typeof process.messages)[0]) => ({
        role: m.role,
        content: m.content,
      }),
    );

    const priorMessages = allMessages;
    const lastAssistant = [...priorMessages]
      .reverse()
      .find((m: { role: string }) => m.role === "assistant");

    let approvedFromChat = false;
    if (
      !replyOnly &&
      process.status !== "approved" &&
      process.status !== "forged" &&
      lastAssistant &&
      assistantAskedAccuracyQuestion(lastAssistant.content) &&
      userConfirmsAccuracy(body.content!)
    ) {
      approvedFromChat = true;
      const { forgeProcessDirect } = await import("@/lib/decisions/service");
      await forgeProcessDirect({
        businessId: process.businessId,
        userId: result.session.userId,
        processId: id,
      });
    }

    if (replyOnly) {
      const last = allMessages[allMessages.length - 1];
      if (!last || last.role !== "user") {
        return NextResponse.json(
          { error: "No user message to reply to" },
          { status: 400 },
        );
      }
    } else {
      let content = body.content!.trim();

      if (body.nodeContext?.label) {
        const prefix = buildNodeCommentPrefix(body.nodeContext.label);
        if (!content.startsWith(prefix)) {
          content = prefix + content;
        }
      }

      await prisma.chatMessage.create({
        data: { processId: id, conversationId, role: "user", content },
      });
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE,
        entityType: "chat",
        entityId: id,
        entityName: process.name,
        summary: `Message in "${process.name}"`,
        metadata: { preview: truncatePreview(content), role: "user" },
        ...liveOccurredNow(),
      });
      allMessages = [...allMessages, { role: "user", content }];
    }

    const lastUserContent =
      allMessages
        .filter((m: { role: string; content: string }) => m.role === "user")
        .at(-1)?.content ?? "";

    if (
      !replyOnly &&
      shouldExecuteSplit({
        userContent: lastUserContent,
        lastAssistantContent: lastAssistant?.content,
        status: approvedFromChat ? "forged" : process.status,
      })
    ) {
      const splitResult = await executeProcessSplit(
        {
          baseUrl: body.baseUrl,
          apiKey: body.apiKey ?? "",
          model: body.model,
        },
        id,
        lastUserContent,
      );

      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_SPLIT,
        entityType: "process",
        entityId: id,
        entityName: process.name,
        summary: `Split "${process.name}" into "${splitResult.childName}"`,
        metadata: {
          parentProcessId: splitResult.parentProcessId,
          childProcessId: splitResult.childProcessId,
        },
        ...liveOccurredNow(),
      });
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
        entityType: "process",
        entityId: splitResult.childProcessId,
        entityName: splitResult.childName,
        summary: `Created process "${splitResult.childName}" from split`,
        metadata: { parentProcessId: splitResult.parentProcessId },
        ...liveOccurredNow(),
      });

      const updated = await prisma.process.findUnique({
        where: { id },
        include: processInclude,
      });

      return NextResponse.json({
        process: updated,
        runBackgroundAgents: false,
        split: splitResult,
      });
    }

    const hermes = {
      baseUrl: body.baseUrl,
      apiKey: body.apiKey ?? "",
      model: body.model,
    };

    const processStatus = approvedFromChat ? "forged" : process.status;
    const preferStream = body.stream !== false;

    const finishTurn = async (assistantContent: string) => {
      await prisma.chatMessage.create({
        data: {
          processId: id,
          conversationId,
          role: "assistant",
          content: assistantContent,
        },
      });

      if (process.nameStatus === "pending" && !/^untitled/i.test(process.name)) {
        const renameIntent =
          /rename|call it|instead|different name|change (the )?name/i.test(
            lastUserContent,
          );
        if (renameIntent) {
          const match = lastUserContent.match(
            /(?:call it|rename (?:it )?(?:to )?|name it)\s+["']?([^"'\n.]+)/i,
          );
          if (match?.[1]?.trim()) {
            await prisma.process.update({
              where: { id },
              data: { name: match[1].trim(), nameStatus: "confirmed" },
            });
          }
        } else {
          await prisma.process.update({
            where: { id },
            data: { nameStatus: "confirmed" },
          });
        }
      }

      return prisma.process.findUnique({
        where: { id },
        include: processInclude,
      });
    };

    const turnInput = {
      processId: id,
      userId: result.session.userId,
      conversationId,
      messages: allMessages,
      hermes,
      processStatus,
      approvedFromChat,
      process: {
        id: process.id,
        businessId: process.businessId,
        name: process.name,
        description: process.description,
        nameStatus: process.nameStatus,
        status: process.status,
        diagramMermaid: process.diagramMermaid,
        trigger: process.trigger,
        inputs: process.inputs,
        outputs: process.outputs,
        manualSteps: process.manualSteps,
        ioShape: process.ioShape,
      },
    };

    if (!preferStream) {
      const { collectProcessChatTurn } = await import(
        "@/lib/chatbar/process-chat-turn"
      );
      const { assistantContent } = await collectProcessChatTurn(turnInput);
      const updated = await finishTurn(assistantContent);
      return NextResponse.json({
        process: updated,
        runBackgroundAgents: true,
        approved: approvedFromChat,
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
          for await (const event of streamProcessChatTurn({
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
              const updated = await finishTurn(event.assistantContent);
              send("done", {
                process: updated,
                runBackgroundAgents: true,
                approved: approvedFromChat,
                message: {
                  role: "assistant",
                  content: event.assistantContent,
                },
                usage: event.usage,
                runId: event.runId,
                stopped: hermesAbort.signal.aborted,
              });
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Chat failed";
          if ((error as Error)?.name === "AbortError") {
            send("done", {
              process: await prisma.process.findUnique({
                where: { id },
                include: processInclude,
              }),
              runBackgroundAgents: false,
              approved: approvedFromChat,
              stopped: true,
              error: message,
            });
          } else {
            send("error", { error: message });
          }
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed */
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
    console.error("Process chat error", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
