import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProcessAccess } from '@/lib/auth';
import { buildApprovalUpdate } from '@/lib/process-approve';
import { canApproveForAutomation, isProcessStatus } from '@/lib/process-status';
import { diffProcessFields, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

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

    if (body.status !== undefined) {
      if (!isProcessStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (body.status === 'approved' && !canApproveForAutomation(result.process)) {
        return NextResponse.json(
          { error: 'Process needs a diagram before it can be approved for automation' },
          { status: 400 }
        );
      }
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
      });
    }

    if (body.status === 'approved' && before.status !== 'approved') {
      await recordBusinessEvent({
        businessId: before.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_APPROVED,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Approved process "${process.name}"`,
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
    });

    await prisma.process.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete process error', error);
    return NextResponse.json({ error: 'Failed to delete process' }, { status: 500 });
  }
}