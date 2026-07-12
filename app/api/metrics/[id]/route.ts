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

const PatchMetricSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  channel: z.enum(METRIC_CHANNELS).optional().nullable(),
  unit: z.string().trim().min(1).max(40).optional(),
  collectionMethod: z.enum(METRIC_COLLECTION_METHODS).optional(),
  cadenceGoal: z.number().finite().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const SampleSchema = z.object({
  value: z.number().finite(),
  notes: z.string().max(1000).optional().nullable(),
  source: z.enum(["manual", "hermes", "import"]).optional(),
  recordedAt: z.string().datetime().optional(),
});

async function loadOwnedMetric(id: string, businessId: string) {
  return prisma.businessMetric.findFirst({
    where: { id, businessId },
  });
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
    const existing = await loadOwnedMetric(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = PatchMetricSchema.parse(await request.json());

    const metric = await prisma.businessMetric.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.channel !== undefined ? { channel: body.channel } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.collectionMethod !== undefined
          ? { collectionMethod: body.collectionMethod }
          : {}),
        ...(body.cadenceGoal !== undefined ? { cadenceGoal: body.cadenceGoal } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    return NextResponse.json(metric);
  } catch (error) {
    console.error("Patch metric error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update metric" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // Record a sample: POST /api/metrics/:id
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const { id } = await context.params;
    const existing = await loadOwnedMetric(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = SampleSchema.parse(await request.json());

    const sample = await prisma.metricSample.create({
      data: {
        metricId: id,
        value: body.value,
        notes: body.notes ?? null,
        source: body.source ?? "manual",
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.METRIC_SAMPLE_RECORDED,
      entityType: "metric",
      entityId: existing.id,
      entityName: existing.name,
      summary: `Recorded ${existing.name}: ${sample.value} ${existing.unit}`,
      metadata: {
        count: sample.value,
        preview: sample.notes ?? undefined,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(sample);
  } catch (error) {
    console.error("Record metric sample error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to record sample" }, { status: 500 });
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
    const existing = await loadOwnedMetric(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.businessMetric.delete({ where: { id } });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.METRIC_DELETED,
      entityType: "metric",
      entityId: existing.id,
      entityName: existing.name,
      summary: `Deleted metric "${existing.name}"`,
      ...liveOccurredNow(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete metric error", error);
    return NextResponse.json({ error: "Failed to delete metric" }, { status: 500 });
  }
}
