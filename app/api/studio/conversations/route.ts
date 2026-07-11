import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  hermesAgentProfileId: z.string().min(1).optional().nullable(),
});

async function resolveHiredAgent(
  businessId: string,
  agentId: string | null | undefined,
) {
  if (!agentId) return null;
  return prisma.hermesAgentProfile.findFirst({
    where: { id: agentId, businessId, isHired: true },
    select: {
      id: true,
      displayName: true,
      description: true,
      model: true,
      profileKey: true,
      iconKey: true,
    },
  });
}

/** List studio conversations for the active business (+ optional hired agent scope). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const agentParam = request.nextUrl.searchParams.get("hermesAgentProfileId");
    const agent = await resolveHiredAgent(business.id, agentParam);

    // When an agent id is requested but not hired, return empty rather than leaking threads
    if (agentParam && !agent) {
      return NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        hermesAgentProfileId: null,
        agent: null,
        conversations: [],
      });
    }

    const where = {
      businessId: business.id,
      kind: "studio" as const,
      ...(agent
        ? { hermesAgentProfileId: agent.id }
        : agentParam
          ? { hermesAgentProfileId: agentParam }
          : {}),
    };

    let conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });

    if (conversations.length === 0 && agent) {
      const created = await prisma.conversation.create({
        data: {
          businessId: business.id,
          kind: "studio",
          title: "Main",
          processId: null,
          hermesAgentProfileId: agent.id,
        },
        include: { _count: { select: { messages: true } } },
      });
      conversations = [created];
    } else if (conversations.length === 0 && !agentParam) {
      // Legacy: unscoped studio Main when no agent filter requested
      const created = await prisma.conversation.create({
        data: {
          businessId: business.id,
          kind: "studio",
          title: "Main",
          processId: null,
          hermesAgentProfileId: null,
        },
        include: { _count: { select: { messages: true } } },
      });
      conversations = [created];
    }

    const hiredAgents = await prisma.hermesAgentProfile.findMany({
      where: { businessId: business.id, isHired: true },
      orderBy: [{ hiredAt: "asc" }, { displayName: "asc" }],
      select: {
        id: true,
        displayName: true,
        description: true,
        model: true,
        profileKey: true,
        iconKey: true,
        isDefault: true,
        hiredAt: true,
      },
    });

    return NextResponse.json({
      businessId: business.id,
      businessName: business.name,
      hermesAgentProfileId: agent?.id ?? null,
      agent,
      hiredAgents,
      conversations,
    });
  } catch (error) {
    console.error("List studio conversations error", error);
    return NextResponse.json({ error: "Failed to list studio conversations" }, { status: 500 });
  }
}

/** Create a new studio conversation for the active business (optionally for a hired agent). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const body = CreateSchema.parse(await request.json().catch(() => ({})));
    const title = body.title?.trim() || "New chat";
    const agent = await resolveHiredAgent(
      business.id,
      body.hermesAgentProfileId ?? undefined,
    );

    if (body.hermesAgentProfileId && !agent) {
      return NextResponse.json(
        { error: "Hired agent not found for this business" },
        { status: 404 },
      );
    }

    const conversation = await prisma.conversation.create({
      data: {
        businessId: business.id,
        kind: "studio",
        title,
        processId: null,
        hermesAgentProfileId: agent?.id ?? null,
      },
      include: { _count: { select: { messages: true } } },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create studio conversation error", error);
    return NextResponse.json({ error: "Failed to create studio conversation" }, { status: 500 });
  }
}
