import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  CONTENT_CHANNELS,
  CONTENT_SOURCES,
  CONTENT_STATUSES,
  emptyContentHealth,
  isContentStatus,
  type ContentHealthCounts,
} from "@/lib/content-types";

const CreateContentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  bodyMarkdown: z.string().max(200_000).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  channel: z.enum(CONTENT_CHANNELS).optional().nullable(),
  source: z.enum(CONTENT_SOURCES).optional(),
  processId: z.string().min(1).optional().nullable(),
  automationId: z.string().min(1).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({
        items: [],
        health: emptyContentHealth(),
        business: null,
      });
    }

    const statusFilter = request.nextUrl.searchParams.get("status");
    const where = {
      businessId: business.id,
      ...(isContentStatus(statusFilter) ? { status: statusFilter } : {}),
    };

    const items = await prisma.contentItem.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    const grouped = await prisma.contentItem.groupBy({
      by: ["status"],
      where: { businessId: business.id },
      _count: { _all: true },
    });

    const health: ContentHealthCounts = emptyContentHealth();
    for (const row of grouped) {
      if (isContentStatus(row.status)) {
        health[row.status] = row._count._all;
        health.total += row._count._all;
      }
    }

    return NextResponse.json({
      items,
      health,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("List content error", error);
    return NextResponse.json({ error: "Failed to list content" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: "No active business. Create or select one first." },
        { status: 400 },
      );
    }

    const body = CreateContentSchema.parse(await request.json());
    const status = body.status ?? "idea";
    const shippedAt = status === "shipped" ? new Date() : null;

    const item = await prisma.contentItem.create({
      data: {
        businessId: business.id,
        title: body.title,
        bodyMarkdown: body.bodyMarkdown ?? "",
        status,
        channel: body.channel ?? null,
        source: body.source ?? "manual",
        processId: body.processId ?? null,
        automationId: body.automationId ?? null,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        shippedAt,
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.CONTENT_CREATED,
      entityType: "content",
      entityId: item.id,
      entityName: item.title,
      summary: `Created content "${item.title}" (${item.status})`,
      metadata: {
        status: item.status,
        type: item.channel ?? undefined,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Create content error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }
}
