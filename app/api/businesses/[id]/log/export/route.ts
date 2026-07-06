import { NextRequest, NextResponse } from 'next/server';
import { requireBusinessAccess } from '@/lib/auth';
import { buildBusinessLogBundle } from '@/lib/business-log-export';
import { storeExportAck } from '@/lib/business-log-export-cache';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    const bundle = await buildBusinessLogBundle(id);
    storeExportAck(id, session.userId, bundle.checksum);

    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Business log export error', error);
    return NextResponse.json({ error: 'Failed to export business log' }, { status: 500 });
  }
}