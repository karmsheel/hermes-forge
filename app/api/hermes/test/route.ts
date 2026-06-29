import { NextRequest, NextResponse } from 'next/server';
import { probeHermesConnection } from '@/lib/hermes-connection';

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Missing baseUrl or apiKey' },
        { status: 400 }
      );
    }

    const result = await probeHermesConnection(baseUrl, apiKey);
    return NextResponse.json({ probe: result });
  } catch (error) {
    console.error('Hermes test error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    );
  }
}