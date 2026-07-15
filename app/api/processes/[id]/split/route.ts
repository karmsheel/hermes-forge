import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProcessAccess } from '@/lib/auth';
import {
  analyzeProcessSplit,
  applyProcessSplit,
  executeProcessSplit,
  parseSplitPlan,
  planProcessSplit,
} from '@/lib/process-split';
import { prisma } from '@/lib/prisma';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const SplitBodySchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  instruction: z.string().optional(),
  /**
   * - analyze: structural only (same as GET; no Hermes)
   * - plan: Hermes preview (no DB write)
   * - apply: persist split (uses plan if provided, else plans then applies)
   */
  action: z.enum(['analyze', 'plan', 'apply']).default('apply'),
  plan: z
    .object({
      parent: z.object({
        name: z.string(),
        description: z.string(),
        diagramMermaid: z.string(),
        assistantNote: z.string(),
      }),
      child: z.object({
        name: z.string(),
        description: z.string(),
        diagramMermaid: z.string(),
        assistantNote: z.string(),
      }),
    })
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function loadUpdatedProcess(id: string) {
  return prisma.process.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      conversations: { orderBy: { createdAt: 'asc' } },
      business: { select: { id: true, name: true } },
    },
  });
}

/** Structural split analysis (no Hermes). */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    const analysis = analyzeProcessSplit(
      result.process.diagramMermaid,
      result.process.status
    );

    return NextResponse.json({
      analysis,
      processId: id,
      processName: result.process.name,
    });
  } catch (error) {
    console.error('Process split analyze error', error);
    return NextResponse.json({ error: 'Failed to analyze diagram' }, { status: 500 });
  }
}

/**
 * Split an overloaded workflow into two single-flow processes.
 *
 * - action=analyze — structural only
 * - action=plan — Hermes plan preview (requires Hermes credentials)
 * - action=apply — write parent update + create child (requires Hermes if no plan body)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = SplitBodySchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    if (body.action === 'analyze') {
      const analysis = analyzeProcessSplit(
        result.process.diagramMermaid,
        result.process.status
      );
      return NextResponse.json({
        analysis,
        processId: id,
        processName: result.process.name,
      });
    }

    const instruction =
      body.instruction?.trim() ||
      'Split into two single-flow workflows for automation.';

    if (body.action === 'plan') {
      if (!body.baseUrl) {
        return NextResponse.json(
          { error: 'Hermes baseUrl is required to plan a split' },
          { status: 400 }
        );
      }
      const { plan, analysis } = await planProcessSplit(
        { baseUrl: body.baseUrl, apiKey: body.apiKey ?? '', model: body.model },
        id,
        instruction
      );
      return NextResponse.json({ plan, analysis, processId: id });
    }

    // apply
    let splitResult;
    const providedPlan = body.plan ? parseSplitPlan(body.plan) : null;

    if (providedPlan) {
      splitResult = await applyProcessSplit(id, providedPlan);
    } else {
      if (!body.baseUrl) {
        return NextResponse.json(
          {
            error:
              'Provide a plan object or Hermes baseUrl to generate and apply a split',
          },
          { status: 400 }
        );
      }
      splitResult = await executeProcessSplit(
        { baseUrl: body.baseUrl, apiKey: body.apiKey ?? '', model: body.model },
        id,
        instruction
      );
    }

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

    const updated = await loadUpdatedProcess(id);

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
