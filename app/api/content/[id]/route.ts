import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  CONTENT_CHANNELS,
  CONTENT_STATUSES,
} from "@/lib/content-types";

const PatchContentSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  bodyMarkdown: z.string().max(200_000).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  channel: z.enum(CONTENT_CHANNELS).optional().nullable(),
  processId: z.string().min(1).optional().nullable(),
  automationId: z.string().min(1).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

async function loadOwnedItem(id: string, businessId: string) {
  return prisma.contentItem.findFirst({
    where: { id, businessId },
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
    const item = await loadOwnedItem(id, business.id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Get content error", error);
    return NextResponse.json({ error: "Failed to load content" }, { status: 500 });
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
    const existing = await loadOwnedItem(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = PatchContentSchema.parse(await request.json());
    const nextStatus = body.status ?? existing.status;
    const statusChanged = body.status !== undefined && body.status !== existing.status;

    let shippedAt = existing.shippedAt;
    if (nextStatus === "shipped" && !shippedAt) {
      shippedAt = new Date();
    } else if (nextStatus !== "shipped") {
      shippedAt = null;
    }

    const item = await prisma.contentItem.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.bodyMarkdown !== undefined ? { bodyMarkdown: body.bodyMarkdown } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.channel !== undefined ? { channel: body.channel } : {}),
        ...(body.processId !== undefined ? { processId: body.processId } : {}),
        ...(body.automationId !== undefined ? { automationId: body.automationId } : {}),
        ...(body.scheduledFor !== undefined
          ? { scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null }
          : {}),
        shippedAt,
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: statusChanged
        ? BUSINESS_EVENT_TYPES.CONTENT_STATUS_CHANGED
        : BUSINESS_EVENT_TYPES.CONTENT_UPDATED,
      entityType: "content",
      entityId: item.id,
      entityName: item.title,
      summary: statusChanged
        ? `Content "${item.title}" → ${item.status}`
        : `Updated content "${item.title}"`,
      metadata: {
        status: item.status,
        changes: statusChanged
          ? [{ field: "status", before: existing.status, after: item.status }]
          : undefined,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Patch content error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update content" }, { status: 500 });
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
    const existing = await loadOwnedItem(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.contentItem.delete({ where: { id } });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.CONTENT_DELETED,
      entityType: "content",
      entityId: existing.id,
      entityName: existing.title,
      summary: `Deleted content "${existing.title}"`,
      ...liveOccurredNow(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete content error", error);
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 });
  }
}
