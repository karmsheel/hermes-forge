import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { WELCOME_MESSAGE } from '@/lib/process-welcome';
import { categorizeWorkflow } from '@/lib/categorize-workflow';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { deriveIoShape, isIoShapeId } from '@/lib/io-shape';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ processes: [], business: null });
    }

    const statusFilter = request.nextUrl.searchParams.get('status');

    const processes = await prisma.process.findMany({
      where: {
        businessId: business.id,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        department: true,
        status: true,
        approvedAt: true,
        nameStatus: true,
        diagramMermaid: true,
        diagramUpdatedAt: true,
        ioShape: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      processes,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('List processes error', error);
    return NextResponse.json({ error: 'Failed to list processes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business. Create or select one first.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const diagramMermaid =
      typeof body.diagramMermaid === 'string' && body.diagramMermaid.trim()
        ? body.diagramMermaid.trim()
        : null;
    const inputs =
      typeof body.inputs === 'string' && body.inputs.trim() ? body.inputs.trim() : null;
    const outputs =
      typeof body.outputs === 'string' && body.outputs.trim() ? body.outputs.trim() : null;
    const explicitShape = isIoShapeId(body.ioShape) ? body.ioShape : null;
    const ioShape = deriveIoShape({
      inputs,
      outputs,
      diagramMermaid,
      explicit: explicitShape,
    });

    const dept = body.department || categorizeWorkflow(`${body.name || ''} ${body.description || ''}`);

    const process = await prisma.process.create({
          data: {
            businessId: business.id,
            name: body.name || 'Untitled Process',
            description: body.description || '',
            department: dept,
            status: 'mapping',
            inputs,
            outputs,
            diagramMermaid,
            diagramUpdatedAt: diagramMermaid ? new Date() : null,
            ioShape,
            conversations: {
              create: {
                title: 'Main',
                businessId: business.id,
                kind: 'process',
              },
            },
          },
          include: {
            conversations: true,
          },
        });

    await prisma.chatMessage.create({
      data: {
        processId: process.id,
        conversationId: process.conversations[0].id,
        role: 'assistant',
        content: WELCOME_MESSAGE,
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
      entityType: 'process',
      entityId: process.id,
      entityName: process.name,
      summary: `Created process "${process.name}"`,
      ...liveOccurredNow(),
    });

    const full = await prisma.process.findUnique({
      where: { id: process.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        conversations: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(full);
  } catch (error) {
    console.error('Create process error', error);
    return NextResponse.json({ error: 'Failed to create process' }, { status: 500 });
  }
}

