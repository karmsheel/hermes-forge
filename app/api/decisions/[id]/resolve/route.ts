import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { DecisionExecuteError } from '@/lib/decisions/execute';
import { resolveDecisionRequest } from '@/lib/decisions/service';

const ResolveSchema = z.object({
  optionId: z.string().min(1),
  comment: z.string().max(5000).optional().nullable(),
});

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
    const body = ResolveSchema.parse(await request.json());

    const result = await resolveDecisionRequest({
      requestId: id,
      businessId: business.id,
      userId: session.userId,
      optionId: body.optionId,
      comment: body.comment,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    if (error instanceof DecisionExecuteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Resolve decision error', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve decision';
    const status =
      message.includes('not found') || message.includes('no longer') || message.includes('Invalid')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
