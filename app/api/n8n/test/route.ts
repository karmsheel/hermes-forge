import { NextRequest, NextResponse } from 'next/server';
import { probeN8nConnection } from '@/lib/n8n-client';

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Missing baseUrl or apiKey' }, { status: 400 });
    }

    const probe = await probeN8nConnection(baseUrl, apiKey);
    return NextResponse.json({ probe });
  } catch (error) {
    console.error('n8n test error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    );
  }
}