import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProcessAccess } from '@/lib/auth';
import { executeProcessSplit } from '@/lib/process-split';
import { prisma } from '@/lib/prisma';

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

    const updated = await prisma.process.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
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