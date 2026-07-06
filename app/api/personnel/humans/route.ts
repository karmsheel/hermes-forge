import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { ensureBusinessOwner } from '@/lib/personnel/ensure-owner';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const CreateHumanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  roleDescription: z.string().trim().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ humans: [], business: null });
    }

    await ensureBusinessOwner(business.id, business.userId);

    const humans = await prisma.humanPersonnel.findMany({
      where: { businessId: business.id },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      humans,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('List humans error', error);
    return NextResponse.json({ error: 'Failed to list personnel' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: 'No active business. Create or select one first.' },
        { status: 400 }
      );
    }

    const body = CreateHumanSchema.parse(await request.json());

    const human = await prisma.humanPersonnel.create({
      data: {
        businessId: business.id,
        name: body.name,
        role: body.role,
        roleDescription: body.roleDescription || null,
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PERSONNEL_ADDED,
      entityType: 'personnel',
      entityId: human.id,
      entityName: human.name,
      summary: `Added "${human.name}" as ${human.role}`,
      metadata: { role: human.role },
      ...liveOccurredNow(),
    });

    return NextResponse.json(human);
  } catch (error) {
    console.error('Create human error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create personnel' }, { status: 500 });
  }
}