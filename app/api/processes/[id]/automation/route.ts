import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assignAutomationAgent,
  buildAutomationStudioData,
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';

type RouteContext = { params: Promise<{ id: string }> };

const PatchAutomationSchema = z.object({
  hermesAgentProfileId: z.string().min(1).nullable(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;

    const automation = await getOrCreateAutomation(id, {
      userId: result.session.userId,
      businessId: result.process.businessId,
    });

    return NextResponse.json(
      await buildAutomationStudioData(result.process, automation)
    );
  } catch (error) {
    console.error('Get automation error', error);
    return NextResponse.json({ error: 'Failed to load automation studio' }, { status: 500 });
  }
}

/** Assign or clear the hired Hermes agent that owns this automation (4.10). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = PatchAutomationSchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;

    const automation = await assignAutomationAgent({
      processId: id,
      businessId: result.process.businessId,
      processName: result.process.name,
      userId: result.session.userId,
      hermesAgentProfileId: body.hermesAgentProfileId,
    });

    return NextResponse.json(await buildAutomationStudioData(result.process, automation));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Patch automation error', error);
    const message = error instanceof Error ? error.message : 'Failed to update automation';
    const status = message.includes('not found') || message.includes('not hired') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
