import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { WELCOME_MESSAGE } from '@/lib/process-welcome';
import { categorizeWorkflow } from '@/lib/categorize-workflow';

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

    const dept = body.department || categorizeWorkflow(`${body.name || ''} ${body.description || ''}`);

    const process = await prisma.process.create({
      data: {
        businessId: business.id,
        name: body.name || 'Untitled Process',
        description: body.description || '',
        department: dept,
        status: 'mapping',
        diagramMermaid,
        diagramUpdatedAt: diagramMermaid ? new Date() : null,
      },
    });

    await prisma.chatMessage.create({
      data: {
        processId: process.id,
        role: 'assistant',
        content: WELCOME_MESSAGE,
      },
    });

    const full = await prisma.process.findUnique({
      where: { id: process.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(full);
  } catch (error) {
    console.error('Create process error', error);
    return NextResponse.json({ error: 'Failed to create process' }, { status: 500 });
  }
}

