import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { listN8nCredentials } from '@/lib/n8n-client';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const baseUrl = request.nextUrl.searchParams.get('baseUrl');
    const apiKey = request.nextUrl.searchParams.get('apiKey');
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Missing baseUrl or apiKey' }, { status: 400 });
    }

    const credentials = await listN8nCredentials(baseUrl, apiKey);
    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('n8n credentials error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list credentials' },
      { status: 502 }
    );
  }
}