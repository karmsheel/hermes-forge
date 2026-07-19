import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildAutomationStudioData,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';
import { controlAutomationCron } from '@/lib/automation-control';
import { HermesCredentialsSchema } from '@/lib/hermes-models';

const ControlSchema = HermesCredentialsSchema.extend({
  action: z.enum(['pause', 'resume']),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST — pause or resume a deployed Hermes cron automation (7.1).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ControlSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;

    const { automation, health } = await controlAutomationCron({
      processId: id,
      action: body.action,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      userId: result.session.userId,
    });

    return NextResponse.json({
      studio: await buildAutomationStudioData(result.process, automation),
      health,
      action: body.action,
    });
  } catch (error) {
    console.error('Automation control error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Control failed';
    const status =
      message.includes('not found') ||
      message.includes('before pause') ||
      message.includes('only available')
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
