/**
 * Shared Foundation draft seed / upsert service (Phase 6.2–6.3).
 */

import { prisma } from "@/lib/prisma";
import { categorizeWorkflow } from "@/lib/categorize-workflow";
import { deriveIoShape, isIoShapeId } from "@/lib/io-shape";
import {
  normalizeSeedDrafts,
  toFoundationProcessCard,
  type FoundationProcessCard,
  type SeedDraftInput,
} from "@/lib/foundation";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import { isProcessForged } from "@/lib/process-status";

const DRAFT_WELCOME =
  "This is a **Foundation draft** — a lightweight block for the plant sketch. Open Workshop to refine it into a full process map with Hermes.";

export type SeedMode = "skip" | "upsert";

export type SeedFoundationResult = {
  created: FoundationProcessCard[];
  updated: FoundationProcessCard[];
  skipped: string[];
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

export async function seedFoundationDrafts(options: {
  businessId: string;
  userId: string;
  drafts: SeedDraftInput[];
  mode?: SeedMode;
}): Promise<SeedFoundationResult> {
  const mode = options.mode ?? "skip";
  const drafts = normalizeSeedDrafts(options.drafts);
  const created: FoundationProcessCard[] = [];
  const updated: FoundationProcessCard[] = [];
  const skipped: string[] = [];

  if (drafts.length === 0) {
    return {
      created,
      updated,
      skipped,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  const existing = await prisma.process.findMany({
    where: { businessId: options.businessId },
    select: {
      id: true,
      name: true,
      status: true,
      description: true,
      department: true,
      trigger: true,
      inputs: true,
      outputs: true,
      ioShape: true,
      diagramMermaid: true,
    },
  });
  const existingByName = new Map(
    existing.map((p) => [p.name.trim().toLowerCase(), p])
  );

  for (const draft of drafts) {
    const key = draft.name.toLowerCase();
    const match = existingByName.get(key);

    const inputs = draft.inputs ?? null;
    const outputs = draft.outputs ?? null;
    const diagramMermaid = draft.diagramMermaid?.trim() || null;
    const explicit = isIoShapeId(draft.ioShape) ? draft.ioShape : null;
    const ioShape = deriveIoShape({
      inputs,
      outputs,
      explicit,
      diagramMermaid,
    });
    const department =
      draft.department ||
      categorizeWorkflow(`${draft.name} ${draft.description || ""}`);

    if (match) {
      if (mode === "skip") {
        skipped.push(draft.name);
        continue;
      }
      // upsert: only mutate non-forged processes
      if (isProcessForged(match.status)) {
        skipped.push(draft.name);
        continue;
      }

      const process = await prisma.process.update({
        where: { id: match.id },
        data: {
          description:
            draft.description !== undefined && draft.description !== null
              ? draft.description
              : undefined,
          department,
          trigger: draft.trigger !== undefined ? draft.trigger : undefined,
          inputs: draft.inputs !== undefined ? inputs : undefined,
          outputs: draft.outputs !== undefined ? outputs : undefined,
          ioShape,
          ...(diagramMermaid
            ? {
                diagramMermaid,
                diagramUpdatedAt: new Date(),
              }
            : {}),
          // Keep seeded stubs as draft until workshop refine / forge
          status: "draft",
          nameStatus: "confirmed",
        },
      });

      await recordBusinessEvent({
        businessId: options.businessId,
        userId: options.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_UPDATED,
        entityType: "process",
        entityId: process.id,
        entityName: process.name,
        summary: `Updated foundation draft "${process.name}"`,
        metadata: {
          preview: `foundation_upsert:${ioShape}`,
          changes: [
            { field: "ioShape", before: match.ioShape, after: ioShape },
            {
              field: "description",
              before: match.description,
              after: process.description,
            },
          ],
        },
        ...liveOccurredNow(),
      });

      const card = toFoundationProcessCard(process);
      updated.push(card);
      existingByName.set(key, {
        id: process.id,
        name: process.name,
        status: process.status,
        description: process.description,
        department: process.department,
        trigger: process.trigger,
        inputs: process.inputs,
        outputs: process.outputs,
        ioShape: process.ioShape,
        diagramMermaid: process.diagramMermaid,
      });
      continue;
    }

    const process = await prisma.process.create({
      data: {
        businessId: options.businessId,
        name: draft.name,
        description: draft.description || "",
        department,
        status: "draft",
        nameStatus: "confirmed",
        trigger: draft.trigger ?? null,
        inputs,
        outputs,
        ioShape,
        diagramMermaid,
        diagramUpdatedAt: diagramMermaid ? new Date() : null,
        conversations: {
          create: {
            title: "Main",
            businessId: options.businessId,
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
      businessId: options.businessId,
      userId: options.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
      entityType: "process",
      entityId: process.id,
      entityName: process.name,
      summary: `Seeded foundation draft "${process.name}"`,
      metadata: { preview: `foundation_seed:${ioShape}` },
      ...liveOccurredNow(),
    });

    const card = toFoundationProcessCard(process);
    created.push(card);
    existingByName.set(key, {
      id: process.id,
      name: process.name,
      status: process.status,
      description: process.description,
      department: process.department,
      trigger: process.trigger,
      inputs: process.inputs,
      outputs: process.outputs,
      ioShape: process.ioShape,
      diagramMermaid: process.diagramMermaid,
    });
  }

  return {
    created,
    updated,
    skipped,
    createdCount: created.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
  };
}
