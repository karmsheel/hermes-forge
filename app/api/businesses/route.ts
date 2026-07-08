import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getSessionFromRequest,
  requireSession,
  setActiveBusinessCookie,
} from '@/lib/auth';
import { markBusinessLogInitialized, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { isBusinessIconKey } from '@/lib/business-avatar';
import { ensureBusinessOwner } from '@/lib/personnel/ensure-owner';

const CreateBusinessSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(5000).optional(),
  industry: z.string().max(100).optional(),
  avatarEmoji: z.string().trim().max(8).nullable().optional(),
  avatarIcon: z.string().trim().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const businesses = await prisma.business.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        avatarEmoji: true,
        avatarIcon: true,
        description: true,
        industry: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { processes: true } },
      },
    });

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error('List businesses error', error);
    return NextResponse.json({ error: 'Failed to list businesses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = CreateBusinessSchema.parse(await request.json());

    if (body.avatarIcon !== undefined && body.avatarIcon !== null && !isBusinessIconKey(body.avatarIcon)) {
      return NextResponse.json({ error: 'Invalid business icon' }, { status: 400 });
    }

    const avatarEmoji = body.avatarEmoji?.trim() || null;
    const avatarIcon =
      body.avatarIcon && isBusinessIconKey(body.avatarIcon) ? body.avatarIcon : null;

    const business = await prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          userId: session.userId,
          name: body.name?.trim() || 'Untitled Project',
          description: body.description?.trim() || null,
          industry: body.industry?.trim() || null,
          avatarEmoji: avatarIcon ? null : avatarEmoji,
          avatarIcon: avatarEmoji ? null : avatarIcon,
        },
        select: {
          id: true,
          name: true,
          avatarEmoji: true,
          avatarIcon: true,
          description: true,
          industry: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { processes: true } },
        },
      });

      await ensureBusinessOwner(created.id, session.userId, tx);

      return created;
    });

    const now = new Date();
    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.BUSINESS_CREATED,
      entityType: 'business',
      entityId: business.id,
      entityName: business.name,
      summary: `Created business "${business.name}"`,
      occurredAt: now,
      occurredAtPrecision: 'exact',
    });
    await markBusinessLogInitialized(business.id);

    const response = NextResponse.json(business);
    setActiveBusinessCookie(response, business.id);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Create business error', error);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}