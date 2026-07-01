import type { DiagramStreamEvent } from './diagram-stream';

export type DiagramStreamHandlers = {
  onPreview?: (mermaid: string) => void;
  onDone?: (mermaid: string) => void;
  onError?: (error: string) => void;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n');
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

export async function consumeDiagramStream(
  response: Response,
  handlers: DiagramStreamHandlers
): Promise<{ ok: boolean; mermaid?: string; error?: string }> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message =
      typeof err.error === 'string' ? err.error : `Diagram stream failed (${response.status})`;
    handlers.onError?.(message);
    return { ok: false, error: message };
  }

  if (!response.body) {
    const message = 'Diagram stream returned no body';
    handlers.onError?.(message);
    return { ok: false, error: message };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMermaid: string | undefined;
  let streamError: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const parsed = parseSseBlock(block);
      if (parsed) {
        try {
          const payload = JSON.parse(parsed.data) as DiagramStreamEvent;
          if (payload.type === 'preview') {
            handlers.onPreview?.(payload.mermaid);
          } else if (payload.type === 'done') {
            finalMermaid = payload.mermaid;
            handlers.onDone?.(payload.mermaid);
          } else if (payload.type === 'error') {
            streamError = payload.error;
            handlers.onError?.(payload.error);
          }
        } catch {
          /* ignore malformed event payloads */
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }

  if (streamError) {
    return { ok: false, error: streamError };
  }

  if (!finalMermaid) {
    const message = 'Diagram stream ended without a final diagram';
    handlers.onError?.(message);
    return { ok: false, error: message };
  }

  return { ok: true, mermaid: finalMermaid };
}