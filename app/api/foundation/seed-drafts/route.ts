import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { categorizeWorkflow } from "@/lib/categorize-workflow";
import { deriveIoShape, isIoShapeId } from "@/lib/io-shape";
import {
  normalizeSeedDrafts,
  toFoundationProcessCard,
} from "@/lib/foundation";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";

const DraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  ioShape: z.string().max(16).optional().nullable(),
  trigger: z.string().max(2000).optional().nullable(),
  inputs: z.string().max(5000).optional().nullable(),
  outputs: z.string().max(5000).optional().nullable(),
});

const BodySchema = z.object({
  drafts: z.array(DraftSchema).min(1).max(40),
  /** When true, skip creating a process if same name already exists (case-insensitive). */
  skipDuplicates: z.boolean().optional().default(true),
});

const DRAFT_WELCOME =
  "This is a **Foundation draft** — a lightweight block for the plant sketch. Open Workshop to refine it into a full process map with Hermes.";

/**
 * POST — seed one or more draft processes for the Foundation room.
 * Idempotent by name when skipDuplicates is true (default).
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
    const drafts = normalizeSeedDrafts(body.drafts);
    if (drafts.length === 0) {
      return NextResponse.json({ error: "No valid drafts" }, { status: 400 });
    }

    const existing = await prisma.process.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true },
    });
    const existingByName = new Map(
      existing.map((p) => [p.name.trim().toLowerCase(), p.id])
    );

    const created: ReturnType<typeof toFoundationProcessCard>[] = [];
    const skipped: string[] = [];

    for (const draft of drafts) {
      const key = draft.name.toLowerCase();
      if (body.skipDuplicates && existingByName.has(key)) {
        skipped.push(draft.name);
        continue;
      }

      const inputs = draft.inputs ?? null;
      const outputs = draft.outputs ?? null;
      const explicit = isIoShapeId(draft.ioShape) ? draft.ioShape : null;
      const ioShape = deriveIoShape({
        inputs,
        outputs,
        explicit,
      });
      const department =
        draft.department ||
        categorizeWorkflow(`${draft.name} ${draft.description || ""}`);

      const process = await prisma.process.create({
        data: {
          businessId: business.id,
          name: draft.name,
          description: draft.description || "",
          department,
          status: "draft",
          nameStatus: "confirmed",
          trigger: draft.trigger ?? null,
          inputs,
          outputs,
          ioShape,
          conversations: {
            create: {
              title: "Main",
              businessId: business.id,
              kind: "process",
            },
          },
        },
        include: {
          conversations: { select: { id: true }, take: 1 },
        },
      });

      const conversationId = process.conversations[0]?.id;
      if (conversationId) {
        await prisma.chatMessage.create({
          data: {
            processId: process.id,
            conversationId,
            role: "assistant",
            content: DRAFT_WELCOME,
          },
        });
      }

      await recordBusinessEvent({
        businessId: business.id,
        userId: session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
        entityType: "process",
        entityId: process.id,
        entityName: process.name,
        summary: `Seeded foundation draft "${process.name}"`,
        metadata: { preview: `foundation_seed:${ioShape}` },
        ...liveOccurredNow(),
      });

      existingByName.set(key, process.id);
      created.push(
        toFoundationProcessCard({
          id: process.id,
          name: process.name,
          description: process.description,
          department: process.department,
          status: process.status,
          ioShape: process.ioShape,
          diagramMermaid: process.diagramMermaid,
          updatedAt: process.updatedAt,
          createdAt: process.createdAt,
        })
      );
    }

    return NextResponse.json({
      created,
      skipped,
      createdCount: created.length,
      skippedCount: skipped.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid draft payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Foundation seed-drafts error", error);
    return NextResponse.json(
      { error: "Failed to seed foundation drafts" },
      { status: 500 }
    );
  }
}
