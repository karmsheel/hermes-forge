import { resolveHermesModel } from './hermes-models';
import {
  normalizeHermesUsage,
  type NormalizedHermesUsage,
} from './chatbar/usage';

export interface HermesConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export type HermesCallResult = {
  content: string;
  usage: NormalizedHermesUsage | null;
};

export type CallHermesOptions = {
  temperature?: number;
  /** Optional Hermes memory / transcript scope headers (HERMES_API_SERVER.md). */
  sessionKey?: string | null;
  sessionId?: string | null;
};

function hermesAuthHeaders(
  config: HermesConfig,
  options?: CallHermesOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  const sessionKey = options?.sessionKey?.trim();
  const sessionId = options?.sessionId?.trim();
  if (sessionKey) headers['X-Hermes-Session-Key'] = sessionKey;
  if (sessionId) headers['X-Hermes-Session-Id'] = sessionId;
  return headers;
}

/** Non-stream call returning content + usage (preferred for new code). */
export async function callHermesWithMeta(
  config: HermesConfig,
  messages: { role: string; content: string }[],
  options?: CallHermesOptions
): Promise<HermesCallResult> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: hermesAuthHeaders(config, options),
    body: JSON.stringify({
      model: resolveHermesModel(config),
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
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: normalizeHermesUsage(data),
  };
}

export async function callHermes(
  config: HermesConfig,
  messages: { role: string; content: string }[],
  options?: CallHermesOptions
): Promise<string> {
  const result = await callHermesWithMeta(config, messages, options);
  return result.content;
}

export { hermesAuthHeaders };

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