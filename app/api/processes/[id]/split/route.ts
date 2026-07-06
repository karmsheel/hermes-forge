import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProcessAccess } from '@/lib/auth';
import { executeProcessSplit } from '@/lib/process-split';
import { prisma } from '@/lib/prisma';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const SplitSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string().optional(),
  instruction: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Split an overloaded workflow into two single-flow processes */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = SplitSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    if (result.process.status === 'approved') {
      return NextResponse.json(
        { error: 'Approved workflows cannot be split' },
        { status: 400 }
      );
    }

    const splitResult = await executeProcessSplit(
      { baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model },
      id,
      body.instruction?.trim() || 'Split into two single-flow workflows for automation.'
    );

    await recordBusinessEvent({
      businessId: result.process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_SPLIT,
      entityType: 'process',
      entityId: id,
      entityName: result.process.name,
      summary: `Split "${result.process.name}" into "${splitResult.childName}"`,
      metadata: {
        parentProcessId: splitResult.parentProcessId,
        childProcessId: splitResult.childProcessId,
      },
      ...liveOccurredNow(),
    });
    await recordBusinessEvent({
      businessId: result.process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
      entityType: 'process',
      entityId: splitResult.childProcessId,
      entityName: splitResult.childName,
      summary: `Created process "${splitResult.childName}" from split`,
      metadata: { parentProcessId: splitResult.parentProcessId },
      ...liveOccurredNow(),
    });

    const updated = await prisma.process.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        conversations: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      process: updated,
      split: splitResult,
    });
  } catch (error) {
    console.error('Process split error', error);
    const message = error instanceof Error ? error.message : 'Split failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}