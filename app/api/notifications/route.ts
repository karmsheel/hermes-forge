import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';

const PatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100).optional(),
  all: z.boolean().optional(),
  read: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = await prisma.notification.findMany({
      where: { businessId: business.id, userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        decisionRequest: {
          select: {
            id: true,
            status: true,
            title: true,
            optionsJson: true,
            hermesAgentProfileId: true,
            conversationId: true,
          },
        },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: {
        businessId: business.id,
        userId: session.userId,
        readAt: null,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        decisionRequestId: n.decisionRequestId,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        decisionRequest: n.decisionRequest
          ? {
              id: n.decisionRequest.id,
              status: n.decisionRequest.status,
              title: n.decisionRequest.title,
              hermesAgentProfileId: n.decisionRequest.hermesAgentProfileId,
              conversationId: n.decisionRequest.conversationId,
              options: (() => {
                try {
                  return JSON.parse(n.decisionRequest.optionsJson);
                } catch {
                  return [];
                }
              })(),
            }
          : null,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('List notifications error', error);
    return NextResponse.json({ error: 'Failed to list notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const body = PatchSchema.parse(await request.json());
    const readAt = body.read ? new Date() : null;

    if (body.all) {
      await prisma.notification.updateMany({
        where: {
          businessId: business.id,
          userId: session.userId,
          ...(body.read ? { readAt: null } : {}),
        },
        data: { readAt },
      });
    } else if (body.ids?.length) {
      await prisma.notification.updateMany({
        where: {
          businessId: business.id,
          userId: session.userId,
          id: { in: body.ids },
        },
        data: { readAt },
      });
    } else {
      return NextResponse.json({ error: 'Provide ids or all' }, { status: 400 });
    }

    const unreadCount = await prisma.notification.count({
      where: {
        businessId: business.id,
        userId: session.userId,
        readAt: null,
      },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Patch notifications error', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
