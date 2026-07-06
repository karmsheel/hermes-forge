import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

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
      type: BUSINESS_EVENT_TYPES.PERSONNEL_REMOVED,
      entityType: 'personnel',
      entityId: human.id,
      entityName: human.name,
      summary: `Removed "${human.name}" from the organization [FIRE]`,
      metadata: { role: human.role },
      ...liveOccurredNow(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete human error', error);
    return NextResponse.json({ error: 'Failed to remove person' }, { status: 500 });
  }
}