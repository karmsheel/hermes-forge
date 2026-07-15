import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import {
  extractDraftsFromText,
  extractDraftsWithHermes,
  messagesToTranscript,
} from "@/lib/foundation-extract";
import { seedFoundationDrafts } from "@/lib/foundation-seed";

const BodySchema = z.object({
  /** Studio conversation to read messages from */
  conversationId: z.string().min(1).optional(),
  /** Raw text / assistant message (optional if conversationId set) */
  text: z.string().max(50_000).optional(),
  /** Prefer Hermes LLM extraction when no forge-drafts fence is found */
  useHermes: z.boolean().optional().default(true),
  /** Apply seeds immediately (upsert mode for non-forged name matches) */
  apply: z.boolean().optional().default(false),
  mode: z.enum(["skip", "upsert"]).optional().default("upsert"),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

/**
 * POST — extract draft process stubs from Foundation chat, optionally apply.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: "No active business. Create or select one first." },
        { status: 400 }
      );
    }

    const body = BodySchema.parse(await request.json());

    let transcript = body.text?.trim() || "";

    if (body.conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: body.conversationId,
          businessId: business.id,
          kind: "studio",
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 60,
            select: { role: true, content: true },
          },
        },
      });
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      const fromMessages = messagesToTranscript(conversation.messages);
      transcript = transcript
        ? `${fromMessages}\n\nADDITIONAL:\n${transcript}`
        : fromMessages;
    }

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "No conversation text to extract from" },
        { status: 400 }
      );
    }

    const existing = await prisma.process.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true },
    });

    let extraction = extractDraftsFromText(transcript, existing);

    if (
      extraction.drafts.length === 0 &&
      body.useHermes &&
      body.baseUrl?.trim()
    ) {
      extraction = await extractDraftsWithHermes(
        {
          baseUrl: body.baseUrl.trim(),
          apiKey: body.apiKey || "",
          model: body.model,
        },
        transcript,
        existing
      );
    }

    if (!body.apply) {
      return NextResponse.json({
        drafts: extraction.drafts,
        source: extraction.source,
        rawFenceFound: extraction.rawFenceFound,
        applied: false,
      });
    }

    if (extraction.drafts.length === 0) {
      return NextResponse.json({
        drafts: [],
        source: extraction.source,
        rawFenceFound: extraction.rawFenceFound,
        applied: false,
        message: "No drafts found to apply",
      });
    }

    const seed = await seedFoundationDrafts({
      businessId: business.id,
      userId: session.userId,
      drafts: extraction.drafts,
      mode: body.mode,
    });

    return NextResponse.json({
      drafts: extraction.drafts,
      source: extraction.source,
      rawFenceFound: extraction.rawFenceFound,
      applied: true,
      ...seed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid extract payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Foundation extract-drafts error", error);
    const message =
      error instanceof Error ? error.message : "Failed to extract drafts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
