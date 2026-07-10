import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

async function requireStudioConversation(request: NextRequest, id: string) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return { error: session };

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      kind: "studio",
      business: { userId: session.userId },
    },
    include: {
      business: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return { error: NextResponse.json({ error: "Conversation not found" }, { status: 404 }) };
  }

  return { session, conversation };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireStudioConversation(request, id);
    if ("error" in result) return result.error;

    const { conversation } = result;
    return NextResponse.json({
      id: conversation.id,
      businessId: conversation.businessId,
      businessName: conversation.business.name,
      kind: conversation.kind,
      title: conversation.title,
      processId: conversation.processId,
      forkedFromId: conversation.forkedFromId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        processId: m.processId,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get studio conversation error", error);
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireStudioConversation(request, id);
    if ("error" in result) return result.error;

    const body = PatchSchema.parse(await request.json());
    const updated = await prisma.conversation.update({
      where: { id },
      data: { title: body.title },
      include: { _count: { select: { messages: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Patch studio conversation error", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
