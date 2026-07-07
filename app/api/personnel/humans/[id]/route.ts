import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { isPersonnelIconKey } from '@/lib/personnel/icon-catalog';

const PatchHumanSchema = z.object({
  iconKey: z.string().trim().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const { id } = await params;
    const body = PatchHumanSchema.parse(await request.json());

    if (body.iconKey !== null && !isPersonnelIconKey(body.iconKey)) {
      return NextResponse.json({ error: 'Invalid icon key' }, { status: 400 });
    }

    const human = await prisma.humanPersonnel.findFirst({
      where: { id, businessId: business.id },
    });

    if (!human) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (human.isOwner) {
      return NextResponse.json({ error: 'Owner icon cannot be changed' }, { status: 403 });
    }

    const updated = await prisma.humanPersonnel.update({
      where: { id: human.id },
      data: { iconKey: body.iconKey },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Patch human error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const { id } = await params;

    const human = await prisma.humanPersonnel.findFirst({
      where: { id, businessId: business.id },
    });

    if (!human) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (human.isOwner) {
      return NextResponse.json(
        { error: 'The business owner cannot be removed' },
        { status: 403 }
      );
    }

    await prisma.humanPersonnel.delete({ where: { id: human.id } });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PERSONNEL_FIRED,
      entityType: 'personnel',
      entityId: human.id,
      entityName: human.name,
      summary: `Fired "${human.name}" from ${business.name} [FIRE]`,
      metadata: {
        kind: 'human',
        role: human.role,
        businessName: business.name,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete human error', error);
    return NextResponse.json({ error: 'Failed to remove person' }, { status: 500 });
  }
}