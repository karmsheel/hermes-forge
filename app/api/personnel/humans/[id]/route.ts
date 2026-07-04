import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete human error', error);
    return NextResponse.json({ error: 'Failed to remove person' }, { status: 500 });
  }
}