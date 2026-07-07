import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { isPersonnelIconKey } from '@/lib/personnel/icon-catalog';

const PatchAgentSchema = z.object({
  iconKey: z.string().trim().nullable(),
});

export async function PATCH(
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
    const body = PatchAgentSchema.parse(await request.json());

    if (body.iconKey !== null && !isPersonnelIconKey(body.iconKey)) {
      return NextResponse.json({ error: 'Invalid icon key' }, { status: 400 });
    }

    const agent = await prisma.hermesAgentProfile.findFirst({
      where: { id, businessId: business.id },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updated = await prisma.hermesAgentProfile.update({
      where: { id: agent.id },
      data: { iconKey: body.iconKey },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Patch agent error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}