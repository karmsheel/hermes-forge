import { NextRequest, NextResponse } from 'next/server';
import { requireProcessAccess } from '@/lib/auth';
import {
  UnforgeProcessError,
  unforgeProcessDirect,
} from '@/lib/decisions/service';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

/** Human reopens a forged process as draft documentation. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    await unforgeProcessDirect({
      businessId: result.process.businessId,
      userId: result.session.userId,
      processId: id,
    });

    const process = await prisma.process.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ process });
  } catch (error) {
    console.error('Unforge process error', error);
    if (error instanceof UnforgeProcessError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
        },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to unforge process',
      },
      { status: 400 }
    );
  }
}
