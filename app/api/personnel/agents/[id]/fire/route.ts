import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

export async function POST(
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

    const agent = await prisma.hermesAgentProfile.findFirst({
      where: { id, businessId: business.id },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.isHired) {
      return NextResponse.json({ error: 'Agent is not hired' }, { status: 409 });
    }

    const updated = await prisma.hermesAgentProfile.update({
      where: { id: agent.id },
      data: { isHired: false, hiredAt: null },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PERSONNEL_FIRED,
      entityType: 'personnel',
      entityId: updated.id,
      entityName: updated.displayName,
      summary: `Fired agent "${updated.displayName}" from ${business.name} [FIRE]`,
      metadata: {
        kind: 'agent',
        businessName: business.name,
        profileKey: updated.profileKey,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Fire agent error', error);
    return NextResponse.json({ error: 'Failed to fire agent' }, { status: 500 });
  }
}