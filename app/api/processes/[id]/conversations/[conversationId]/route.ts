import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProcessAccess } from "@/lib/auth";
import { canDeleteProcessConversation } from "@/lib/conversation-fork";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string; conversationId: string }>;
};

async function requireProcessConversation(processId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      processId,
      kind: "process",
    },
  });
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: processId, conversationId } = await context.params;
    const access = await requireProcessAccess(request, processId);
    if ("error" in access) return access.error;

    const existing = await requireProcessConversation(processId, conversationId);
    if (!existing) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = PatchSchema.parse(await request.json());
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: body.title },
      include: { _count: { select: { messages: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Rename process conversation error", error);
    return NextResponse.json({ error: "Failed to rename conversation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: processId, conversationId } = await context.params;
    const access = await requireProcessAccess(request, processId);
    if ("error" in access) return access.error;

    const existing = await requireProcessConversation(processId, conversationId);
    if (!existing) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const count = await prisma.conversation.count({
      where: { processId, kind: "process" },
    });
    if (!canDeleteProcessConversation(count)) {
      return NextResponse.json(
        { error: "Cannot delete the only conversation for this process" },
        { status: 400 },
      );
    }

    await prisma.conversation.delete({ where: { id: conversationId } });

    const remaining = await prisma.conversation.findMany({
      where: { processId, kind: "process" },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { messages: true } } },
    });

    return NextResponse.json({
      deletedId: conversationId,
      conversations: remaining,
    });
  } catch (error) {
    console.error("Delete process conversation error", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
