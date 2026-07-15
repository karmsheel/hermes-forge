import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  linkValidationMessage,
  toProcessLinkDto,
  validateProcessLinkEndpoints,
} from "@/lib/process-links";

const CreateSchema = z.object({
  fromProcessId: z.string().min(1),
  toProcessId: z.string().min(1),
  label: z.string().max(200).optional().nullable(),
  fromPort: z.string().max(80).optional().nullable(),
  toPort: z.string().max(80).optional().nullable(),
});

/** GET — list plant edges for the active business. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ links: [], business: null });
    }

    const links = await prisma.processLink.findMany({
      where: { businessId: business.id },
      include: {
        fromProcess: { select: { name: true } },
        toProcess: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      links: links.map(toProcessLinkDto),
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("List process links error", error);
    return NextResponse.json(
      { error: "Failed to list process links" },
      { status: 500 }
    );
  }
}

/** POST — create a directed process link within the active business. */
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

    const body = CreateSchema.parse(await request.json());

    const [fromProc, toProc] = await Promise.all([
      prisma.process.findFirst({
        where: { id: body.fromProcessId, businessId: business.id },
        select: { id: true, name: true, businessId: true },
      }),
      prisma.process.findFirst({
        where: { id: body.toProcessId, businessId: business.id },
        select: { id: true, name: true, businessId: true },
      }),
    ]);

    if (!fromProc || !toProc) {
      return NextResponse.json(
        {
          error: linkValidationMessage(
            !fromProc ? "missing_from" : "missing_to"
          ),
        },
        { status: 400 }
      );
    }

    const invalid = validateProcessLinkEndpoints({
      fromProcessId: body.fromProcessId,
      toProcessId: body.toProcessId,
      fromBusinessId: fromProc.businessId,
      toBusinessId: toProc.businessId,
      expectedBusinessId: business.id,
    });
    if (invalid) {
      return NextResponse.json(
        { error: linkValidationMessage(invalid) },
        { status: 400 }
      );
    }

    const existing = await prisma.processLink.findUnique({
      where: {
        businessId_fromProcessId_toProcessId: {
          businessId: business.id,
          fromProcessId: body.fromProcessId,
          toProcessId: body.toProcessId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: linkValidationMessage("duplicate"), link: toProcessLinkDto(existing) },
        { status: 409 }
      );
    }

    const link = await prisma.processLink.create({
      data: {
        businessId: business.id,
        fromProcessId: body.fromProcessId,
        toProcessId: body.toProcessId,
        label: body.label?.trim() || null,
        fromPort: body.fromPort?.trim() || null,
        toPort: body.toPort?.trim() || null,
      },
      include: {
        fromProcess: { select: { name: true } },
        toProcess: { select: { name: true } },
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_LINK_CREATED,
      entityType: "process_link",
      entityId: link.id,
      entityName: `${fromProc.name} → ${toProc.name}`,
      summary: `Linked "${fromProc.name}" → "${toProc.name}"`,
      metadata: {
        preview: `${fromProc.name} → ${toProc.name}`,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(toProcessLinkDto(link), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid link payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Create process link error", error);
    return NextResponse.json(
      { error: "Failed to create process link" },
      { status: 500 }
    );
  }
}
