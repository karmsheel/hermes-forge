import { NextRequest, NextResponse } from 'next/server';
import {
  buildAutomationStudioData,
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from '@/lib/automation-access';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;

    const automation = await getOrCreateAutomation(id);

    return NextResponse.json(buildAutomationStudioData(result.process, automation));
  } catch (error) {
    console.error('Get automation error', error);
    return NextResponse.json({ error: 'Failed to load automation studio' }, { status: 500 });
  }
}