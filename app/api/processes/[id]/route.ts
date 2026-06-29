import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const process = await prisma.process.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    return NextResponse.json(process);
  } catch (error) {
    console.error('Get process error', error);
    return NextResponse.json({ error: 'Failed to load process' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const process = await prisma.process.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        department: body.department,
        diagramMermaid: body.diagramMermaid,
        diagramUpdatedAt: body.diagramMermaid ? new Date() : undefined,
      },
    });

    return NextResponse.json(process);
  } catch (error) {
    console.error('Update process error', error);
    return NextResponse.json({ error: 'Failed to update process' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await prisma.process.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete process error', error);
    return NextResponse.json({ error: 'Failed to delete process' }, { status: 500 });
  }
}