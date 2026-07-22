import type { CallHermesOptions, HermesConfig } from "./hermes";
import { hermesAuthHeaders } from "./hermes";
import { resolveHermesModel } from "./hermes-models";
import { toolEventsFromOpenAiChunk } from "./chatbar/runtime-events";
import {
  normalizeHermesUsage,
  type NormalizedHermesUsage,
} from "./chatbar/usage";

export type HermesStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; event: Record<string, unknown> }
  | { type: "run"; runId: string }
  | { type: "usage"; usage: NormalizedHermesUsage };

/**
 * Drain OpenAI-style SSE lines into text deltas (legacy API).
 */
export function drainOpenAiSseBuffer(
  chunk: string,
  onDelta: (text: string) => void,
): string {
  return drainOpenAiSseBufferEvents(chunk, (event) => {
    if (event.type === "delta") onDelta(event.text);
  });
}

/**
 * Drain OpenAI-style SSE into structured events (text + tool activity).
 * Also accepts Hermes custom SSE lines with `event:` prefix carried as
 * multi-line blocks when embedded in `data:` JSON.
 */
export function drainOpenAiSseBufferEvents(
  chunk: string,
  onEvent: (event: HermesStreamEvent) => void,
): string {
  let remainder = chunk;

  while (remainder.includes("\n")) {
    const newlineIndex = remainder.indexOf("\n");
    const line = remainder.slice(0, newlineIndex).trim();
    remainder = remainder.slice(newlineIndex + 1);

    if (!line.startsWith("data:")) continue;

    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;

      const runId = String(
        parsed.run_id || parsed.runId || parsed.id || "",
      ).trim();
      // Only emit run ids that look like Hermes run ids (avoid OpenAI completion ids)
      if (
        runId &&
        (parsed.object === "hermes.run" ||
          typeof parsed.run_id === "string" ||
          typeof parsed.runId === "string")
      ) {
        onEvent({ type: "run", runId });
      }

      const contentDelta = (
        parsed.choices as Array<{ delta?: { content?: string } }> | undefined
      )?.[0]?.delta?.content;
      if (contentDelta) {
        onEvent({ type: "delta", text: contentDelta });
      }

      for (const toolEvent of toolEventsFromOpenAiChunk(parsed)) {
        onEvent({ type: "tool", event: toolEvent });
      }

      const usage = normalizeHermesUsage(parsed);
      if (usage) {
        onEvent({ type: "usage", usage });
      }
    } catch {
      /* ignore malformed SSE lines */
    }
  }

  return remainder;
}

export type StreamHermesOptions = CallHermesOptions & {
  signal?: AbortSignal;
};

export async function* streamHermes(
  config: HermesConfig,
  messages: { role: string; content: string }[],
  options?: StreamHermesOptions,
): AsyncGenerator<string> {
  for await (const event of streamHermesEvents(config, messages, options)) {
    if (event.type === "delta") yield event.text;
  }
}

/**
 * Optional post-stream poll for usage when the SSE path did not emit it.
 * Best-effort — failures return null.
 */
export async function fetchHermesRunUsage(
  config: HermesConfig,
  runId: string,
  options?: CallHermesOptions,
): Promise<NormalizedHermesUsage | null> {
  const id = runId.trim();
  if (!id) return null;
  try {
    const url = `${config.baseUrl.replace(/\/$/, "")}/v1/runs/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: hermesAuthHeaders(config, options),
      signal: options && "signal" in options ? undefined : undefined,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return normalizeHermesUsage(data) ?? normalizeHermesUsage(data?.usage);
  } catch {
    return null;
  }
}

export async function* streamHermesEvents(
  config: HermesConfig,
  messages: { role: string; content: string }[],
  options?: StreamHermesOptions,
): AsyncGenerator<HermesStreamEvent> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: hermesAuthHeaders(config, options),
    body: JSON.stringify({
      model: resolveHermesModel(config),
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hermes error: ${response.status} — ${errText}`);
  }

  if (!response.body) {
    throw new Error("Hermes returned an empty stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (options?.signal?.aborted) {
        await reader.cancel().catch(() => {});
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        throw err;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const pending: HermesStreamEvent[] = [];
      buffer = drainOpenAiSseBufferEvents(buffer, (event) => pending.push(event));
      for (const event of pending) {
        yield event;
      }
    }

    if (buffer.trim()) {
      const pending: HermesStreamEvent[] = [];
      drainOpenAiSseBufferEvents(`${buffer}\n`, (event) => pending.push(event));
      for (const event of pending) {
        yield event;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}
