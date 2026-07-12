import { NextRequest, NextResponse } from 'next/server';
import { requireProcessAccess } from '@/lib/auth';
import { forgeProcessDirect } from '@/lib/decisions/service';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

/** Human forges (locks) a process as live business documentation. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    await forgeProcessDirect({
      businessId: result.process.businessId,
      userId: result.session.userId,
      processId: id,
    });

    const process = await prisma.process.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ process });
  } catch (error) {
    console.error('Forge process error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to forge process' },
      { status: 400 }
    );
  }
}
