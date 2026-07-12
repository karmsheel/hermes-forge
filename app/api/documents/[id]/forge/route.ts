import { NextRequest, NextResponse } from 'next/server';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { forgeDocumentDirect } from '@/lib/decisions/service';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const { id } = await context.params;
    await forgeDocumentDirect({
      businessId: business.id,
      userId: session.userId,
      documentId: id,
    });

    const doc = await prisma.businessDocument.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(doc);
  } catch (error) {
    console.error('Forge document error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to forge document' },
      { status: 400 }
    );
  }
}
