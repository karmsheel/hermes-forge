import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  buildAutomationStudioData,
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const SaveSchema = z.object({
  credentialMap: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string().optional(),
    })
  ),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = SaveSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;

    const automation = await getOrCreateAutomation(id, { userId: result.session.userId });
    const updated = await prisma.automation.update({
      where: { id: automation.id },
      data: { credentialMapJson: JSON.stringify(body.credentialMap) },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    await recordBusinessEvent({
      businessId: result.process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.AUTOMATION_CREDENTIALS_MAPPED,
      entityType: 'automation',
      entityId: id,
      entityName: result.process.name,
      summary: `Mapped credentials for "${result.process.name}"`,
      metadata: { count: Object.keys(body.credentialMap).length },
      ...liveOccurredNow(),
    });

    return NextResponse.json(buildAutomationStudioData(result.process, updated));
  } catch (error) {
    console.error('Save credential map error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}