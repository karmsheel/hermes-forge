import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProcessAccess } from '@/lib/auth';

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

    const process = await prisma.process.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        department: body.department,
        diagramMermaid: body.diagramMermaid,
        diagramUpdatedAt: body.diagramMermaid ? new Date() : undefined,
        nameStatus: body.name !== undefined ? 'confirmed' : undefined,
      },
    });

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

    await prisma.process.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete process error', error);
    return NextResponse.json({ error: 'Failed to delete process' }, { status: 500 });
  }
}