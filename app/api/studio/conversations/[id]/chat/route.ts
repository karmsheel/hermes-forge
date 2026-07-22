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
import { formatTrainingForPrompt } from "@/lib/personnel/agent-training";
import { fetchHermesRunUsage, streamHermesEvents } from "@/lib/hermes-stream";
import type { NormalizedHermesUsage } from "@/lib/chatbar/usage";
import { hermesSessionCallOptions } from "@/lib/chatbar/session-headers";
import { normalizeRuntimeEvent } from "@/lib/chatbar/runtime-events";
import { prisma } from "@/lib/prisma";
import {
  documentsPromptAddon,
  loadDocumentsForPrompt,
} from "@/lib/documents";
import {
  applyPlantFromAssistantText,
  hasPlantApplyFences,
  shouldAutoApplyPlant,
  summarizePlantApply,
} from "@/lib/plant-apply";

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

const ChatSchema = z
  .object({
    content: z.string().trim().min(1).max(20_000).optional(),
    /** Home/Foundation seed: reply to last user message without re-inserting it */
    replyOnly: z.boolean().optional(),
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
  })
  .refine((data) => data.replyOnly === true || !!data.content?.trim(), {
    message: "content is required unless replyOnly is true",
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
        hermesAgentProfile: {
          select: {
            id: true,
            displayName: true,
            description: true,
            model: true,
            profileKey: true,
            isHired: true,
          },
        },
      },
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const route = body.route || "/home";
    const page = pageBlurbForPath(route);
    const replyOnly = body.replyOnly === true;
    const mode = normalizeChatbarContextMode(body.contextMode);

    let content: string;
    let userMessage: {
      id: string;
      content: string;
      createdAt: Date;
      conversationId: string | null;
    };

    if (replyOnly) {
      const last = conversation.messages[conversation.messages.length - 1];
      if (!last || last.role !== "user") {
        return Response.json(
          { error: "No user message to reply to" },
          { status: 400 },
        );
      }
      content = last.content;
      userMessage = {
        id: last.id,
        content: last.content,
        createdAt: last.createdAt,
        conversationId: last.conversationId,
      };
    } else {
      content = body.content!.trim();
      userMessage = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          processId: null,
          role: "user",
          content,
        },
      });
    }

    const agent = conversation.hermesAgentProfile?.isHired
      ? conversation.hermesAgentProfile
      : null;

    let trainingPrompt: string | null = null;
    if (agent) {
      const training = await prisma.agentTrainingItem.findMany({
        where: {
          businessId: conversation.business.id,
          OR: [
            { hermesAgentProfileId: agent.id },
            { hermesAgentProfileId: null },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { kind: true, name: true, content: true },
      });
      // Prefer items assigned to this agent; still include a few unassigned library items
      const assigned = training.filter(() => true);
      trainingPrompt = formatTrainingForPrompt(assigned) || null;
    }

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

    // replyOnly: last message is already the user turn; exclude it from prior history
    const priorSource = replyOnly
      ? conversation.messages.slice(0, -1)
      : conversation.messages;
    const prior = priorSource.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 4.18 — durable knowledge docs (basics + pinned) for studio co-pilot
    let knowledgeNote = "";
    if (mode !== CHATBAR_CONTEXT_MODES.CHAT_ONLY) {
      try {
        const docs = await loadDocumentsForPrompt(conversation.business.id, prisma);
        knowledgeNote = documentsPromptAddon(docs, 2000);
      } catch (err) {
        console.warn("Studio chat knowledge docs failed", err);
      }
    }

    const hermesMessages: { role: string; content: string }[] = [
      {
        role: "system",
        content: buildStudioChatSystemPrompt({
          businessName: conversation.business.name,
          route,
          page,
          mode,
          agent: agent
            ? {
                displayName: agent.displayName,
                description: agent.description,
                model: agent.model,
                profileKey: agent.profileKey,
              }
            : null,
          trainingPrompt,
        }),
      },
      {
        role: "system",
        content: buildStudioPageContextMessage({ payload: safePayload }),
      },
      ...(knowledgeNote
        ? [{ role: "system" as const, content: knowledgeNote }]
        : []),
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
        let lastUsage: NormalizedHermesUsage | null = null;
        let aborted = false;

        const hermesConfig = {
          baseUrl: body.baseUrl,
          apiKey: body.apiKey ?? "",
          model: body.model,
        };

        const sessionOpts = hermesSessionCallOptions({
          userId: session.userId,
          businessId: conversation.business.id,
          agentProfileKey: agent?.profileKey ?? null,
          conversationId: conversation.id,
        });

        try {
          for await (const event of streamHermesEvents(
            hermesConfig,
            hermesMessages,
            {
              signal: hermesAbort.signal,
              sessionKey: sessionOpts.sessionKey,
              sessionId: sessionOpts.sessionId,
            },
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

            if (event.type === "usage") {
              lastUsage = event.usage;
              send("usage", event.usage);
              continue;
            }

            if (event.type === "delta") {
              assistantText += event.text;
              send("delta", { text: event.text });
            }
          }

          // Tier A: if stream omitted usage, try run status poll
          if (!lastUsage && runId && !aborted && !hermesAbort.signal.aborted) {
            const polled = await fetchHermesRunUsage(hermesConfig, runId, {
              sessionKey: sessionOpts.sessionKey,
              sessionId: sessionOpts.sessionId,
            });
            if (polled) {
              lastUsage = polled;
              send("usage", polled);
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

          // 6.2 / 6.5 — auto-apply plant fences (forge-drafts / forge-docs / forge-links)
          let plantApply: Awaited<
            ReturnType<typeof applyPlantFromAssistantText>
          > | null = null;
          let plantSummary: string | null = null;
          if (
            shouldAutoApplyPlant(route) &&
            hasPlantApplyFences(finalText) &&
            mode !== CHATBAR_CONTEXT_MODES.CHAT_ONLY
          ) {
            try {
              plantApply = await applyPlantFromAssistantText({
                businessId: conversation.business.id,
                userId: session.userId,
                assistantText: finalText,
                conversationId: conversation.id,
                hermesAgentProfileId: agent?.id ?? null,
              });
              plantSummary = summarizePlantApply(plantApply);
              if (plantApply.applied) {
                send("plant_apply", {
                  result: plantApply,
                  summary: plantSummary,
                  conversationId: conversation.id,
                  assistantMessageId: assistantMessage.id,
                });
                send("tool_activity", {
                  tool_name: "plant_apply",
                  tool_call_id: `plant-${assistantMessage.id}`,
                  status: plantApply.errors.length ? "error" : "completed",
                  preview: plantSummary || "Plant data applied",
                });
              }
            } catch (err) {
              console.warn("Plant auto-apply failed", err);
              send("plant_apply", {
                result: null,
                error:
                  err instanceof Error ? err.message : "Plant apply failed",
                conversationId: conversation.id,
                assistantMessageId: assistantMessage.id,
              });
            }
          }

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
            plantApply: plantApply
              ? { result: plantApply, summary: plantSummary }
              : undefined,
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
