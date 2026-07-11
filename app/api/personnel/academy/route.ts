import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { isAgentTrainingKind } from "@/lib/personnel/agent-training";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  kind: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  content: z.string().min(1).max(500_000),
  fileName: z.string().trim().max(260).optional().nullable(),
  hermesAgentProfileId: z.string().min(1).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ items: [], hiredAgents: [], business: null });
    }

    const [items, hiredAgents] = await Promise.all([
      prisma.agentTrainingItem.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        include: {
          hermesAgentProfile: {
            select: { id: true, displayName: true, isHired: true },
          },
        },
      }),
      prisma.hermesAgentProfile.findMany({
        where: { businessId: business.id, isHired: true },
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          profileKey: true,
          model: true,
          iconKey: true,
        },
      }),
    ]);

    return NextResponse.json({
      items,
      hiredAgents,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("List academy items error", error);
    return NextResponse.json({ error: "Failed to list academy items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const body = CreateSchema.parse(await request.json());
    if (!isAgentTrainingKind(body.kind)) {
      return NextResponse.json(
        { error: "kind must be skill, soul, or profile" },
        { status: 400 },
      );
    }

    let agentId: string | null = body.hermesAgentProfileId ?? null;
    if (agentId) {
      const agent = await prisma.hermesAgentProfile.findFirst({
        where: { id: agentId, businessId: business.id, isHired: true },
        select: { id: true },
      });
      if (!agent) {
        return NextResponse.json(
          { error: "Hired agent not found for this business" },
          { status: 404 },
        );
      }
    }

    const item = await prisma.agentTrainingItem.create({
      data: {
        businessId: business.id,
        hermesAgentProfileId: agentId,
        kind: body.kind,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        content: body.content,
        fileName: body.fileName?.trim() || null,
        source: "upload",
      },
      include: {
        hermesAgentProfile: {
          select: { id: true, displayName: true, isHired: true },
        },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create academy item error", error);
    return NextResponse.json({ error: "Failed to create academy item" }, { status: 500 });
  }
}
