export interface HermesConfig {
  baseUrl: string;
  apiKey: string;
}

export async function callHermes(
  config: HermesConfig,
  messages: { role: string; content: string }[],
  options?: { temperature?: number }
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages,
      stream: false,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hermes error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export function parseJsonFromLlm(content: string): unknown {
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse JSON from LLM response');
  }
}

export function stripMermaidFences(content: string): string {
  return content
    .replace(/^```mermaid\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}