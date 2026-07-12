import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProcessAccess } from '@/lib/auth';
import { buildApprovalUpdate } from '@/lib/process-approve';
import {
  canForgeProcess,
  isProcessForged,
  isProcessStatus,
  normalizeProcessStatus,
} from '@/lib/process-status';
import { diffProcessFields, liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import {
  forgeProcessDirect,
  recordLiveOwnerEdit,
} from '@/lib/decisions/service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    return NextResponse.json(result.process);
  } catch (error) {
    console.error('Get process error', error);
    return NextResponse.json({ error: 'Failed to load process' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    const body = await request.json();
    const actor: string = typeof body.actor === 'string' ? body.actor : 'human';
    const confirmLiveEdit = body.confirmLiveEdit === true;

    // Agent cannot mutate forged processes without a decision
    if (actor === 'agent' && isProcessForged(result.process.status)) {
      return NextResponse.json(
        {
          error:
            'This process is forged. Create a decision request for the owner to approve changes.',
          code: 'FORGED_REQUIRES_DECISION',
        },
        { status: 403 }
      );
    }

    if (body.status !== undefined) {
      if (!isProcessStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const next = normalizeProcessStatus(body.status);
      if (next === 'forged' && !canForgeProcess(result.process)) {
        return NextResponse.json(
          { error: 'Process needs a diagram before it can be forged' },
          { status: 400 }
        );
      }
      // Prefer forge helper for human forge so decision record is written
      if (next === 'forged' && !isProcessForged(result.process.status) && actor !== 'agent') {
        await forgeProcessDirect({
          businessId: result.process.businessId,
          userId: result.session.userId,
          processId: id,
        });
        const process = await prisma.process.findUniqueOrThrow({ where: { id } });
        return NextResponse.json(process);
      }
    }

    const contentFields = [
      'name',
      'description',
      'department',
      'trigger',
      'inputs',
      'outputs',
      'manualSteps',
      'diagramMermaid',
    ];
    const touchesContent = contentFields.some((k) => body[k] !== undefined);

    if (
      actor === 'human' &&
      isProcessForged(result.process.status) &&
      touchesContent &&
      !confirmLiveEdit
    ) {
      return NextResponse.json(
        {
          error:
            'This process is live forged documentation. Confirm live edit to continue.',
          code: 'CONFIRM_LIVE_EDIT',
        },
        { status: 409 }
      );
    }

    const approvalPatch =
      body.status !== undefined ? buildApprovalUpdate(body.status) : {};

    const before = result.process;
    const process = await prisma.process.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        department: body.department,
        trigger: body.trigger,
        inputs: body.inputs,
        outputs: body.outputs,
        manualSteps: body.manualSteps,
        diagramMermaid: body.diagramMermaid,
        diagramUpdatedAt: body.diagramMermaid ? new Date() : undefined,
        nameStatus: body.name !== undefined ? 'confirmed' : undefined,
        ...approvalPatch,
      },
    });

    const changes = diffProcessFields(
      before as unknown as Record<string, unknown>,
      body as Record<string, unknown>
    );
    if (changes.length > 0) {
      await recordBusinessEvent({
        businessId: before.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_UPDATED,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Updated process "${process.name}"`,
        metadata: { changes },
        ...liveOccurredNow(),
      });
    }

    if (
      actor === 'human' &&
      isProcessForged(before.status) &&
      touchesContent &&
      confirmLiveEdit
    ) {
      await recordLiveOwnerEdit({
        businessId: before.businessId,
        userId: result.session.userId,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Owner edited live forged process "${process.name}"`,
      });
    }

    if (
      body.status !== undefined &&
      normalizeProcessStatus(body.status) === 'forged' &&
      !isProcessForged(before.status)
    ) {
      await recordBusinessEvent({
        businessId: before.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_APPROVED,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Forged process "${process.name}"`,
        occurredAt: process.approvedAt ?? new Date(),
        occurredAtPrecision: 'exact',
      });
    }

    if (body.diagramMermaid && body.diagramMermaid !== before.diagramMermaid) {
      await recordBusinessEvent({
        businessId: before.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_DIAGRAM_UPDATED,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Updated diagram for "${process.name}"`,
        occurredAt: process.diagramUpdatedAt ?? new Date(),
        occurredAtPrecision: 'exact',
      });
    }

    if (body.name !== undefined && body.name !== before.name) {
      await recordBusinessEvent({
        businessId: before.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_NAME_CONFIRMED,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Confirmed name "${process.name}"`,
        ...liveOccurredNow(),
      });
    }

    return NextResponse.json(process);
  } catch (error) {
    console.error('Update process error', error);
    return NextResponse.json({ error: 'Failed to update process' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    await recordBusinessEvent({
      businessId: result.process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_DELETED,
      entityType: 'process',
      entityId: id,
      entityName: result.process.name,
      summary: `Deleted process "${result.process.name}"`,
      ...liveOccurredNow(),
    });

    await prisma.process.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete process error', error);
    return NextResponse.json({ error: 'Failed to delete process' }, { status: 500 });
  }
}
