import { NextRequest, NextResponse } from 'next/server';
import { resolveHermesModel } from '@/lib/hermes-models';

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey, model, messages, system } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Missing Hermes baseUrl or apiKey' }, { status: 400 });
    }

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

    const openaiMessages = [];
    if (system) {
      openaiMessages.push({ role: 'system', content: system });
    }
    openaiMessages.push(...messages);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolveHermesModel({ model }),
        messages: openaiMessages,
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ 
        error: `Hermes error: ${response.status}`, 
        details: errText 
      }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response from Hermes.';

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Hermes proxy error', error);
    return NextResponse.json({ error: error.message || 'Proxy failed' }, { status: 500 });
  }
}
