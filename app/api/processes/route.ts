import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';

const WELCOME_MESSAGE =
  "Hi! I'm Hermes. Let's map out a business process together — you'll see the diagram build live in the center as we talk.\n\nWhat process would you like to document? Start with what triggers it and who is involved.";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ processes: [], business: null });
    }

    const processes = await prisma.process.findMany({
      where: { businessId: business.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        department: true,
        status: true,
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

    const process = await prisma.process.create({
      data: {
        businessId: business.id,
        name: body.name || 'Untitled Process',
        description: body.description || '',
        department: body.department || 'Operations',
        status: 'mapping',
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

export { WELCOME_MESSAGE };