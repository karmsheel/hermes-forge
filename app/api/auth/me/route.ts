import { NextRequest, NextResponse } from 'next/server';
import { getActiveBusinessId, getCurrentUser, getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ user: null, activeBusiness: null });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null, activeBusiness: null });
    }

    const businessId = await getActiveBusinessId(request);
    let activeBusiness = null;

    if (businessId) {
      activeBusiness = await prisma.business.findFirst({
        where: { id: businessId, userId: user.id },
        select: {
          id: true,
          name: true,
          description: true,
          industry: true,
          _count: { select: { processes: true } },
        },
      });
    }

    if (!activeBusiness) {
      activeBusiness = await prisma.business.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          industry: true,
          _count: { select: { processes: true } },
        },
      });
    }

    return NextResponse.json({ user, activeBusiness });
  } catch (error) {
    console.error('Me error', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}