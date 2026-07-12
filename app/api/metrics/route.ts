import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  METRIC_CHANNELS,
  METRIC_COLLECTION_METHODS,
} from "@/lib/metric-types";
import { emptyContentHealth, isContentStatus, type ContentHealthCounts } from "@/lib/content-types";

const CreateMetricSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.enum(METRIC_CHANNELS).optional().nullable(),
  unit: z.string().trim().min(1).max(40).optional(),
  collectionMethod: z.enum(METRIC_COLLECTION_METHODS).optional(),
  cadenceGoal: z.number().finite().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({
        metrics: [],
        contentHealth: emptyContentHealth(),
        business: null,
      });
    }

    const metrics = await prisma.businessMetric.findMany({
      where: { businessId: business.id },
      orderBy: [{ name: "asc" }],
      include: {
        samples: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });

    const grouped = await prisma.contentItem.groupBy({
      by: ["status"],
      where: { businessId: business.id },
      _count: { _all: true },
    });

    const contentHealth: ContentHealthCounts = emptyContentHealth();
    for (const row of grouped) {
      if (isContentStatus(row.status)) {
        contentHealth[row.status] = row._count._all;
        contentHealth.total += row._count._all;
      }
    }

    return NextResponse.json({
      metrics: metrics.map((m) => ({
        id: m.id,
        name: m.name,
        channel: m.channel,
        unit: m.unit,
        collectionMethod: m.collectionMethod,
        cadenceGoal: m.cadenceGoal,
        notes: m.notes,
        latestSample: m.samples[0]
          ? {
              value: m.samples[0].value,
              recordedAt: m.samples[0].recordedAt,
              source: m.samples[0].source,
              notes: m.samples[0].notes,
            }
          : null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      contentHealth,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("List metrics error", error);
    return NextResponse.json({ error: "Failed to list metrics" }, { status: 500 });
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

    const body = CreateMetricSchema.parse(await request.json());

    const metric = await prisma.businessMetric.create({
      data: {
        businessId: business.id,
        name: body.name,
        channel: body.channel ?? null,
        unit: body.unit ?? "count",
        collectionMethod: body.collectionMethod ?? "manual",
        cadenceGoal: body.cadenceGoal ?? null,
        notes: body.notes ?? null,
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.METRIC_CREATED,
      entityType: "metric",
      entityId: metric.id,
      entityName: metric.name,
      summary: `Defined metric "${metric.name}"`,
      metadata: {
        type: metric.channel ?? undefined,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(metric);
  } catch (error) {
    console.error("Create metric error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create metric" }, { status: 500 });
  }
}
