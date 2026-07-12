import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import {
  createDecisionRequest,
  serializeDecisionRequest,
} from '@/lib/decisions/service';

const OptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  kind: z.enum(['approve', 'reject', 'redirect', 'custom']),
  actionKey: z.string().max(64).optional(),
  primary: z.boolean().optional(),
});

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(2000),
  contextMarkdown: z.string().max(50_000).optional(),
  urgency: z.enum(['normal', 'high']).optional(),
  proposerKind: z.enum(['agent', 'forge', 'system']).default('forge'),
  hermesAgentProfileId: z.string().min(1).nullable().optional(),
  conversationId: z.string().min(1).nullable().optional(),
  relatedEntityType: z.string().max(40).nullable().optional(),
  relatedEntityId: z.string().min(1).nullable().optional(),
  relatedEntityName: z.string().max(200).nullable().optional(),
  options: z.array(OptionSchema).min(1).max(8),
  proposedActions: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ pending: [], recent: [], records: [] });
    }

    const [pendingRows, recentRows, records] = await Promise.all([
      prisma.decisionRequest.findMany({
        where: { businessId: business.id, status: 'pending' },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        include: {
          hermesAgentProfile: {
            select: { id: true, displayName: true, profileKey: true },
          },
        },
      }),
      prisma.decisionRequest.findMany({
        where: {
          businessId: business.id,
          status: { in: ['resolved', 'redirected', 'cancelled'] },
        },
        orderBy: { resolvedAt: 'desc' },
        take: 30,
        include: {
          hermesAgentProfile: {
            select: { id: true, displayName: true, profileKey: true },
          },
        },
      }),
      prisma.businessDecision.findMany({
        where: { businessId: business.id },
        orderBy: { recordedAt: 'desc' },
        take: 40,
      }),
    ]);

    return NextResponse.json({
      pending: pendingRows.map(serializeDecisionRequest),
      recent: recentRows.map(serializeDecisionRequest),
      records: records.map((r) => ({
        id: r.id,
        title: r.title,
        statement: r.statement,
        kind: r.kind,
        status: r.status,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        recordedAt: r.recordedAt.toISOString(),
        relatedEntityType: r.relatedEntityType,
        relatedEntityId: r.relatedEntityId,
        sourceRequestId: r.sourceRequestId,
      })),
      business: { id: business.id, name: business.name },
      pendingCount: pendingRows.length,
    });
  } catch (error) {
    console.error('List decisions error', error);
    return NextResponse.json({ error: 'Failed to list decisions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const body = CreateSchema.parse(await request.json());

    if (body.hermesAgentProfileId) {
      const agent = await prisma.hermesAgentProfile.findFirst({
        where: {
          id: body.hermesAgentProfileId,
          businessId: business.id,
          isHired: true,
        },
      });
      if (!agent) {
        return NextResponse.json({ error: 'Hired agent not found' }, { status: 400 });
      }
    }

    const created = await createDecisionRequest({
      businessId: business.id,
      userId: session.userId,
      title: body.title,
      summary: body.summary,
      contextMarkdown: body.contextMarkdown,
      urgency: body.urgency,
      proposerKind: body.proposerKind,
      hermesAgentProfileId: body.hermesAgentProfileId,
      conversationId: body.conversationId,
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      relatedEntityName: body.relatedEntityName,
      options: body.options,
      proposedActions: body.proposedActions as Parameters<
        typeof createDecisionRequest
      >[0]['proposedActions'],
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Create decision error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create decision' },
      { status: 500 }
    );
  }
}
