import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

/** List studio conversations for the active business; ensure a default Main exists. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    let conversations = await prisma.conversation.findMany({
      where: { businessId: business.id, kind: "studio" },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });

    if (conversations.length === 0) {
      const created = await prisma.conversation.create({
        data: {
          businessId: business.id,
          kind: "studio",
          title: "Main",
          processId: null,
        },
        include: { _count: { select: { messages: true } } },
      });
      conversations = [created];
    }

    return NextResponse.json({
      businessId: business.id,
      businessName: business.name,
      conversations,
    });
  } catch (error) {
    console.error("List studio conversations error", error);
    return NextResponse.json({ error: "Failed to list studio conversations" }, { status: 500 });
  }
}

/** Create a new studio conversation for the active business. */
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

    const conversation = await prisma.conversation.create({
      data: {
        businessId: business.id,
        kind: "studio",
        title,
        processId: null,
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
