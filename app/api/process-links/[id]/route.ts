import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import { toProcessLinkDto } from "@/lib/process-links";

type RouteContext = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  label: z.string().max(200).optional().nullable(),
  fromPort: z.string().max(80).optional().nullable(),
  toPort: z.string().max(80).optional().nullable(),
});

async function loadOwnedLink(linkId: string, userId: string, businessId: string) {
  return prisma.processLink.findFirst({
    where: {
      id: linkId,
      businessId,
      business: { userId },
    },
    include: {
      fromProcess: { select: { name: true } },
      toProcess: { select: { name: true } },
    },
  });
}

/** PATCH — update label/ports on a plant edge. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const existing = await loadOwnedLink(id, session.userId, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const body = PatchSchema.parse(await request.json());
    const link = await prisma.processLink.update({
      where: { id },
      data: {
        label: body.label !== undefined ? body.label?.trim() || null : undefined,
        fromPort:
          body.fromPort !== undefined ? body.fromPort?.trim() || null : undefined,
        toPort: body.toPort !== undefined ? body.toPort?.trim() || null : undefined,
      },
      include: {
        fromProcess: { select: { name: true } },
        toProcess: { select: { name: true } },
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_LINK_UPDATED,
      entityType: "process_link",
      entityId: link.id,
      entityName: `${link.fromProcess.name} → ${link.toProcess.name}`,
      summary: `Updated link "${link.fromProcess.name}" → "${link.toProcess.name}"`,
      ...liveOccurredNow(),
    });

    return NextResponse.json(toProcessLinkDto(link));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid patch", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Patch process link error", error);
    return NextResponse.json(
      { error: "Failed to update process link" },
      { status: 500 }
    );
  }
}

/** DELETE — remove a plant edge. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const existing = await loadOwnedLink(id, session.userId, business.id);
    if (!existing) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await prisma.processLink.delete({ where: { id } });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_LINK_DELETED,
      entityType: "process_link",
      entityId: id,
      entityName: `${existing.fromProcess.name} → ${existing.toProcess.name}`,
      summary: `Removed link "${existing.fromProcess.name}" → "${existing.toProcess.name}"`,
      ...liveOccurredNow(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete process link error", error);
    return NextResponse.json(
      { error: "Failed to delete process link" },
      { status: 500 }
    );
  }
}
