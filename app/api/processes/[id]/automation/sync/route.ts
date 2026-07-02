import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildAutomationStudioData,
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';
import { syncProcessCronLink } from '@/lib/automation-sync';
import { recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const SyncSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = SyncSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    await getOrCreateAutomation(id, { userId: result.session.userId });

    const syncResult = await syncProcessCronLink(
      id,
      process.name,
      body.baseUrl,
      body.apiKey,
      process.businessId
    );

    if (!syncResult.automation) {
      return NextResponse.json({ linked: false });
    }

    if (syncResult.linked) {
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.AUTOMATION_SYNCED,
        entityType: 'automation',
        entityId: id,
        entityName: process.name,
        summary: `Synced Hermes cron for "${process.name}"`,
      });
    }

    return NextResponse.json({
      linked: syncResult.linked,
      jobId: syncResult.jobId ?? null,
      studio: buildAutomationStudioData(process, syncResult.automation),
    });
  } catch (error) {
    console.error('Automation sync error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}