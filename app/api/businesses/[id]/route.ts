import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireBusinessAccess } from '@/lib/auth';
import { diffBusinessFields, recordBusinessEvent } from '@/lib/business-log';
import { consumeExportAck } from '@/lib/business-log-export-cache';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

type RouteContext = { params: Promise<{ id: string }> };

const DeleteBusinessSchema = z.object({
  exportChecksum: z.string().length(64),
});

const UpdateBusinessSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  teamSize: z.number().int().positive().optional(),
  goals: z.string().max(500).optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        processes: { orderBy: { automationScore: 'desc' } },
        memories: { orderBy: { lastUpdated: 'desc' }, take: 12 },
      },
    });

    return NextResponse.json(business);
  } catch (error) {
    console.error('Get business error', error);
    return NextResponse.json({ error: 'Failed to load business' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    const body = UpdateBusinessSchema.parse(await request.json());

    const before = await prisma.business.findUnique({ where: { id } });
    const business = await prisma.business.update({
      where: { id },
      data: body,
    });

    if (before) {
      const changes = diffBusinessFields(
        before as Record<string, unknown>,
        body as Record<string, unknown>
      );
      if (changes.length > 0) {
        await recordBusinessEvent({
          businessId: id,
          userId: session.userId,
          type: BUSINESS_EVENT_TYPES.BUSINESS_UPDATED,
          entityType: 'business',
          entityId: id,
          entityName: business.name,
          summary: `Updated business "${business.name}"`,
          metadata: { changes },
          occurredAt: new Date(),
          occurredAtPrecision: 'exact',
        });
      }
    }

    return NextResponse.json(business);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Update business error', error);
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = DeleteBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Export the business log and confirm archive before deleting. Call GET /api/businesses/[id]/log/export first.',
        },
        { status: 400 }
      );
    }

    if (!consumeExportAck(id, session.userId, parsed.data.exportChecksum)) {
      return NextResponse.json(
        {
          error:
            'Invalid or expired export checksum. Export the business log again before deleting.',
        },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id },
      select: { name: true },
    });

    await recordBusinessEvent({
      businessId: id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.BUSINESS_DELETED,
      entityType: 'business',
      entityId: id,
      entityName: business?.name ?? 'Business',
      summary: `Deleted business "${business?.name ?? 'Business'}"`,
      occurredAt: new Date(),
      occurredAtPrecision: 'exact',
    });

    await prisma.business.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete business error', error);
    return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 });
  }
}