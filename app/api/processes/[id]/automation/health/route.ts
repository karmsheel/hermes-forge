import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildAutomationStudioData,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';
import { refreshAutomationHealth } from '@/lib/automation-control';
import { HermesCredentialsSchema } from '@/lib/hermes-models';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST — refresh owner-facing run health for a deployed automation (7.1).
 * Uses Hermes job API + optional Cronalytics fact DB; never requires Cronalytics UI.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = HermesCredentialsSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;

    const { automation, health } = await refreshAutomationHealth({
      processId: id,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      alert: true,
    });

    return NextResponse.json({
      studio: await buildAutomationStudioData(result.process, automation),
      health,
    });
  } catch (error) {
    console.error('Automation health error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Health refresh failed';
    const status = message.includes('not found') ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
