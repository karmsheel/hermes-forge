import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  buildForgeContext,
  FORGE_CONTEXT_PROTOCOL,
  type ForgeContextPayload,
  type PageContextRegistration,
} from "@/lib/chatbar/context-protocol";
import {
  CHATBAR_CONTEXT_MODES,
  normalizeChatbarContextMode,
} from "@/lib/chatbar/context-scope";
import { buildServerPageSnapshot } from "@/lib/chatbar/page-snapshot-server";
import {
  buildStudioChatSystemPrompt,
  buildStudioPageContextMessage,
  autoStudioTitleFromText,
} from "@/lib/chatbar/studio-prompt";
import { pageBlurbForPath } from "@/lib/chatbar/page-registry";
import { streamHermesEvents } from "@/lib/hermes-stream";
import { normalizeRuntimeEvent } from "@/lib/chatbar/runtime-events";
import { prisma } from "@/lib/prisma";

const PinnedSchema = z
  .object({
    type: z.enum(["process", "automation", "person", "function", "event"]),
    id: z.string().min(1).max(200),
    label: z.string().min(1).max(500),
  })
  .optional();

const SelectionSchema = z
  .object({
    type: z.string().min(1).max(100),
    summary: z.string().min(1).max(2000),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

const ChatSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  baseUrl: z.string().min(1),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  route: z.string().optional(),
  /** chat-only | follow-page | pinned-entity */
  contextMode: z.string().optional(),
  firstVisit: z.boolean().optional(),
  /** Page-registered live selection / extra snapshot lines */
  registration: z
    .object({
      selection: SelectionSchema,
      snapshotLines: z.array(z.string().max(2000)).max(20).optional(),
      pinned: PinnedSchema,
    })
    .optional()
    .nullable(),
  /** Client may send a prebuilt payload; server still re-validates/rebuilds safely */
  context: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function sseEncode(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Studio chatbar send — streams assistant deltas as SSE.
 * Events: user, receipt, run_id, tool / tool_activity, delta, done, error
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireSession(request);
    if (session instanceof Response) return session;

    const body = ChatSchema.parse(await request.json());
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        kind: "studio",
        business: { userId: session.userId },
      },
      include: {
        business: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 80 },
      },
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const route = body.route || "/home";
    const page = pageBlurbForPath(route);
    const content = body.content.trim();
    const mode = normalizeChatbarContextMode(body.contextMode);

    let shellSnapshotText = "";
    if (mode !== CHATBAR_CONTEXT_MODES.CHAT_ONLY) {
      try {
        const snap = await buildServerPageSnapshot({
          businessId: conversation.business.id,
          businessName: conversation.business.name,
          route,
        });
        shellSnapshotText = snap.text;
      } catch (err) {
        console.warn("Studio chat snapshot failed", err);
        shellSnapshotText = `Page: ${page.title}\nPurpose: ${page.purpose}`;
      }
    }

    const registration = (body.registration || null) as PageContextRegistration | null;

    const { payload, receipt } = buildForgeContext({
      mode,
      route,
      page,
      business: {
        id: conversation.business.id,
        name: conversation.business.name,
      },
      firstVisit: Boolean(body.firstVisit),
      registration,
      shellSnapshotText,
    });

    // Prefer server-built payload; ignore untrusted client protocol overrides for secrets
    const safePayload: ForgeContextPayload = {
      ...payload,
      protocol: FORGE_CONTEXT_PROTOCOL,
    };

    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        processId: null,
        role: "user",
        content,
      },
    });

    const prior = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const hermesMessages: { role: string; content: string }[] = [
      {
        role: "system",
        content: buildStudioChatSystemPrompt({
          businessName: conversation.business.name,
          route,
          page,
          mode,
        }),
      },
      {
        role: "system",
        content: buildStudioPageContextMessage({ payload: safePayload }),
      },
      ...prior,
      {
        role: "user",
        content: [
          "USER_REQUEST_START",
          content,
          "USER_REQUEST_END",
        ].join("\n"),
      },
    ];

    const shouldAutoTitle =
      conversation.messages.length === 0 &&
      isDefaultStudioTitle(conversation.title);

    const clientAbort = request.signal;
    const hermesAbort = new AbortController();
    const onClientAbort = () => hermesAbort.abort();
    if (clientAbort.aborted) {
      hermesAbort.abort();
    } else {
      clientAbort.addEventListener("abort", onClientAbort, { once: true });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(sseEncode(event, data));
          } catch {
            /* controller already closed */
          }
        };

        send("user", {
          id: userMessage.id,
          role: "user",
          content: userMessage.content,
          createdAt: userMessage.createdAt.toISOString(),
          conversationId: conversation.id,
          processId: null,
        });

        send("receipt", {
          messageId: userMessage.id,
          receipt,
        });

        let assistantText = "";
        let runId: string | null = null;
        let aborted = false;

        try {
          for await (const event of streamHermesEvents(
            {
              baseUrl: body.baseUrl,
              apiKey: body.apiKey ?? "",
              model: body.model,
            },
            hermesMessages,
            { signal: hermesAbort.signal },
          )) {
            if (hermesAbort.signal.aborted) {
              aborted = true;
              break;
            }

            if (event.type === "run") {
              runId = event.runId;
              send("run_id", { runId });
              continue;
            }

            if (event.type === "tool") {
              const normalized = normalizeRuntimeEvent(event.event);
              send("tool", {
                ...normalized,
                event: event.event,
              });
              send("tool_activity", {
                ...normalized,
                event: event.event,
              });
              continue;
            }

            if (event.type === "delta") {
              assistantText += event.text;
              send("delta", { text: event.text });
            }
          }

          if (aborted || hermesAbort.signal.aborted) {
            const partial =
              assistantText.trim() ||
              "_(Response stopped before Hermes finished.)_";
            const assistantMessage = await prisma.chatMessage.create({
              data: {
                conversationId: conversation.id,
                processId: null,
                role: "assistant",
                content: partial,
              },
            });
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() },
            });
            send("done", {
              message: {
                id: assistantMessage.id,
                role: "assistant",
                content: partial,
                createdAt: assistantMessage.createdAt.toISOString(),
                conversationId: conversation.id,
                processId: null,
              },
              title: conversation.title,
              receipt,
              stopped: true,
              runId,
            });
            return;
          }

          const finalText =
            assistantText.trim() ||
            "I did not get a response from Hermes. Check the connection and try again.";

          const assistantMessage = await prisma.chatMessage.create({
            data: {
              conversationId: conversation.id,
              processId: null,
              role: "assistant",
              content: finalText,
            },
          });

          let title = conversation.title;
          if (shouldAutoTitle) {
            title = autoStudioTitleFromText(content);
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { title, updatedAt: new Date() },
            });
          } else {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() },
            });
          }

          send("done", {
            message: {
              id: assistantMessage.id,
              role: "assistant",
              content: finalText,
              createdAt: assistantMessage.createdAt.toISOString(),
              conversationId: conversation.id,
              processId: null,
            },
            title,
            receipt,
            runId,
          });
        } catch (error) {
          const isAbort =
            (error instanceof Error && error.name === "AbortError") ||
            hermesAbort.signal.aborted;
          if (isAbort) {
            const partial =
              assistantText.trim() ||
              "_(Response stopped before Hermes finished.)_";
            try {
              const assistantMessage = await prisma.chatMessage.create({
                data: {
                  conversationId: conversation.id,
                  processId: null,
                  role: "assistant",
                  content: partial,
                },
              });
              send("done", {
                message: {
                  id: assistantMessage.id,
                  role: "assistant",
                  content: partial,
                  createdAt: assistantMessage.createdAt.toISOString(),
                  conversationId: conversation.id,
                  processId: null,
                },
                title: conversation.title,
                receipt,
                stopped: true,
                runId,
              });
            } catch {
              send("done", {
                stopped: true,
                runId,
                message: {
                  id: `stopped-${Date.now()}`,
                  role: "assistant",
                  content: partial,
                  createdAt: new Date().toISOString(),
                  conversationId: conversation.id,
                  processId: null,
                },
              });
            }
          } else {
            const message = error instanceof Error ? error.message : "Chat failed";
            send("error", { error: message });
          }
        } finally {
          clientAbort.removeEventListener("abort", onClientAbort);
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
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Studio chat error", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

function isDefaultStudioTitle(title: string): boolean {
  const t = String(title || "").trim().toLowerCase();
  return !t || t === "main" || t === "new chat" || t === "studio chat";
}
