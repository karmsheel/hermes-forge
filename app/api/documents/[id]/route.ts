import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent, truncatePreview } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  allocateDocumentSlug,
  DOCUMENT_KINDS,
  isDocumentKind,
} from "@/lib/documents";

const UpdateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(DOCUMENT_KINDS).optional(),
  bodyMarkdown: z.string().max(200_000).optional(),
  pinnedForContext: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  lifecycleStatus: z.enum(["draft", "refined", "forged"]).optional(),
  /** When true, re-slug from new title (seed slugs like basics stay fixed). */
  renameSlug: z.boolean().optional(),
  actor: z.enum(["human", "agent"]).optional(),
  confirmLiveEdit: z.boolean().optional(),
  conversationId: z.string().min(1).nullable().optional(),
  hermesAgentProfileId: z.string().min(1).nullable().optional(),
});

async function getOwnedDocument(documentId: string, businessId: string) {
  return prisma.businessDocument.findFirst({
    where: { id: documentId, businessId },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const { id } = await context.params;
    const doc = await getOwnedDocument(id, business.id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Get document error", error);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const { id } = await context.params;
    const existing = await getOwnedDocument(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const body = UpdateDocumentSchema.parse(await request.json());
    const actor = body.actor ?? "human";

    if (actor === "agent" && existing.lifecycleStatus === "forged") {
      const { proposeForgedDocumentPatch } = await import("@/lib/decisions/propose");
      const decision = await proposeForgedDocumentPatch({
        businessId: business.id,
        userId: session.userId,
        documentId: existing.id,
        documentTitle: existing.title,
        lifecycleStatus: existing.lifecycleStatus,
        patch: {
          title: body.title,
          bodyMarkdown: body.bodyMarkdown,
          kind: body.kind,
          pinnedForContext: body.pinnedForContext,
        },
        conversationId: body.conversationId ?? null,
        hermesAgentProfileId: body.hermesAgentProfileId ?? null,
      });
      return NextResponse.json(
        {
          error:
            "This document is forged. A decision was created for the owner to approve the change.",
          code: "FORGED_REQUIRES_DECISION",
          decisionPending: true,
          decisionId: decision?.id ?? null,
          decision,
        },
        { status: 403 },
      );
    }

    if (body.lifecycleStatus === "forged" && existing.lifecycleStatus !== "forged") {
      const { forgeDocumentDirect } = await import("@/lib/decisions/service");
      await forgeDocumentDirect({
        businessId: business.id,
        userId: session.userId,
        documentId: existing.id,
      });
      const forged = await prisma.businessDocument.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return NextResponse.json(forged);
    }

    const contentTouch =
      body.title !== undefined ||
      body.bodyMarkdown !== undefined ||
      body.kind !== undefined;

    if (
      actor === "human" &&
      existing.lifecycleStatus === "forged" &&
      contentTouch &&
      !body.confirmLiveEdit
    ) {
      return NextResponse.json(
        {
          error:
            "This document is live forged knowledge. Confirm live edit to continue.",
          code: "CONFIRM_LIVE_EDIT",
        },
        { status: 409 },
      );
    }

    const data: {
      title?: string;
      kind?: string;
      bodyMarkdown?: string;
      pinnedForContext?: boolean;
      sortOrder?: number;
      slug?: string;
      source?: string;
      lifecycleStatus?: string;
      forgedAt?: Date | null;
    } = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.kind !== undefined && isDocumentKind(body.kind)) data.kind = body.kind;
    if (body.bodyMarkdown !== undefined) data.bodyMarkdown = body.bodyMarkdown;
    if (body.pinnedForContext !== undefined) data.pinnedForContext = body.pinnedForContext;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.lifecycleStatus !== undefined && body.lifecycleStatus !== "forged") {
      data.lifecycleStatus = body.lifecycleStatus;
      data.forgedAt = null;
    }

    const seededSlugs = new Set(["basics", "customers", "market", "strategy"]);
    if (
      body.title !== undefined &&
      body.renameSlug &&
      !seededSlugs.has(existing.slug)
    ) {
      data.slug = await allocateDocumentSlug(
        business.id,
        body.title,
        prisma,
        existing.id,
      );
    }

    // Manual edits leave source as-is unless it was seed and body changed
    if (body.bodyMarkdown !== undefined && existing.source === "seed") {
      data.source = "manual";
    }

    const doc = await prisma.businessDocument.update({
      where: { id: existing.id },
      data,
    });

    const changed: string[] = [];
    if (body.title !== undefined && body.title !== existing.title) changed.push("title");
    if (body.bodyMarkdown !== undefined && body.bodyMarkdown !== existing.bodyMarkdown) {
      changed.push("body");
    }
    if (
      body.pinnedForContext !== undefined &&
      body.pinnedForContext !== existing.pinnedForContext
    ) {
      changed.push("pin");
    }

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.DOCUMENT_UPDATED,
      entityType: "document",
      entityId: doc.id,
      entityName: doc.title,
      summary:
        changed.length > 0
          ? `Updated document "${doc.title}" (${changed.join(", ")})`
          : `Updated document "${doc.title}"`,
      metadata: {
        documentKind: doc.kind,
        documentSlug: doc.slug,
        pinnedForContext: doc.pinnedForContext,
        preview:
          body.bodyMarkdown !== undefined
            ? truncatePreview(body.bodyMarkdown, 120)
            : undefined,
      },
      ...liveOccurredNow(),
    });

    if (
      actor === "human" &&
      existing.lifecycleStatus === "forged" &&
      contentTouch &&
      body.confirmLiveEdit
    ) {
      const { recordLiveOwnerEdit } = await import("@/lib/decisions/service");
      await recordLiveOwnerEdit({
        businessId: business.id,
        userId: session.userId,
        entityType: "document",
        entityId: doc.id,
        entityName: doc.title,
        summary: `Owner edited live forged document "${doc.title}"`,
      });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Update document error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const { id } = await context.params;
    const existing = await getOwnedDocument(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Protect core seed docs from accidental delete — reset body instead? Prefer hard block.
    const protectedSlugs = new Set(["basics"]);
    if (protectedSlugs.has(existing.slug) && existing.source === "seed") {
      return NextResponse.json(
        { error: "The Basics document cannot be deleted. Clear or edit its content instead." },
        { status: 400 },
      );
    }

    await prisma.businessDocument.delete({ where: { id: existing.id } });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.DOCUMENT_DELETED,
      entityType: "document",
      entityId: existing.id,
      entityName: existing.title,
      summary: `Deleted document "${existing.title}"`,
      metadata: {
        documentKind: existing.kind,
        documentSlug: existing.slug,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete document error", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
