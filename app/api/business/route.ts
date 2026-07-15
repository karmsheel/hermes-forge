import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(null);
    }

    const full = await prisma.business.findUnique({
      where: { id: business.id },
      include: {
        processes: { orderBy: { automationScore: 'desc' } },
        functions: { orderBy: { name: 'asc' } },
        memories: { orderBy: { lastUpdated: 'desc' }, take: 12 },
      },
    });

    return NextResponse.json(full);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}