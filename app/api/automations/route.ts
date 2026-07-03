import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { automationStatusToDeployStatus } from '@/lib/automation-types';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ processes: [], business: null });
    }

    const processes = await prisma.process.findMany({
      where: {
        businessId: business.id,
        status: 'approved',
      },
      orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        department: true,
        status: true,
        approvedAt: true,
        nameStatus: true,
        diagramMermaid: true,
        diagramUpdatedAt: true,
        trigger: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
        automation: {
          select: { status: true, type: true, externalId: true },
        },
      },
    });

        const items = processes.map((process: typeof processes[0]) => {
          const { automation, ...proc } = process;
          return {
            ...proc,
            automationStatus: automationStatusToDeployStatus(
              automation as { status: string; type: string | null; externalId?: string | null } | null
            ),
          };
        });

        return NextResponse.json({
      processes: items,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('List automations error', error);
    return NextResponse.json({ error: 'Failed to list automations' }, { status: 500 });
  }
}