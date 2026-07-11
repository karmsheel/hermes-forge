import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PatchSchema = z.object({
  hermesAgentProfileId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const { id } = await context.params;
    const existing = await prisma.agentTrainingItem.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Training item not found" }, { status: 404 });
    }

    const body = PatchSchema.parse(await request.json());
    let agentId = body.hermesAgentProfileId;

    if (agentId !== undefined && agentId !== null) {
      const agent = await prisma.hermesAgentProfile.findFirst({
        where: { id: agentId, businessId: business.id, isHired: true },
        select: { id: true },
      });
      if (!agent) {
        return NextResponse.json({ error: "Hired agent not found" }, { status: 404 });
      }
    }

    const updated = await prisma.agentTrainingItem.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() || null }
          : {}),
        ...(body.hermesAgentProfileId !== undefined
          ? { hermesAgentProfileId: agentId }
          : {}),
      },
      include: {
        hermesAgentProfile: {
          select: { id: true, displayName: true, isHired: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Patch academy item error", error);
    return NextResponse.json({ error: "Failed to update academy item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const { id } = await context.params;
    const existing = await prisma.agentTrainingItem.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Training item not found" }, { status: 404 });
    }

    await prisma.agentTrainingItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete academy item error", error);
    return NextResponse.json({ error: "Failed to delete academy item" }, { status: 500 });
  }
}
