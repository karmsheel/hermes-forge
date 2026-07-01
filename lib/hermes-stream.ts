import type { HermesConfig } from './hermes';
import { resolveHermesModel } from './hermes-models';

export function drainOpenAiSseBuffer(
  chunk: string,
  onDelta: (text: string) => void
): string {
  let remainder = chunk;

  while (remainder.includes('\n')) {
    const newlineIndex = remainder.indexOf('\n');
    const line = remainder.slice(0, newlineIndex).trim();
    remainder = remainder.slice(newlineIndex + 1);

    if (!line.startsWith('data:')) continue;

    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) onDelta(delta);
    } catch {
      /* ignore malformed SSE lines */
    }
  }

  return remainder;
}

export async function* streamHermes(
  config: HermesConfig,
  messages: { role: string; content: string }[],
  options?: { temperature?: number }
): AsyncGenerator<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: resolveHermesModel(config),
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hermes error: ${response.status} — ${errText}`);
  }

  if (!response.body) {
    throw new Error('Hermes returned an empty stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const pending: string[] = [];
    buffer = drainOpenAiSseBuffer(buffer, (text) => pending.push(text));
    for (const text of pending) {
      yield text;
    }
  }

  if (buffer.trim()) {
    const pending: string[] = [];
    drainOpenAiSseBuffer(`${buffer}\n`, (text) => pending.push(text));
    for (const text of pending) {
      yield text;
    }
  }
}