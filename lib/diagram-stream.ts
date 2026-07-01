import type { HermesConfig } from './hermes';
import { streamHermes } from './hermes-stream';
import { extractPartialMermaid } from './mermaid-partial';
import { sanitizeMermaidSource } from './mermaid-sanitize';
import {
  buildDiagramMessages,
  type DiagramGenerationInput,
} from './diagram';

export type DiagramStreamEvent =
  | { type: 'preview'; mermaid: string }
  | { type: 'done'; mermaid: string }
  | { type: 'error'; error: string };

export async function* streamDiagramMermaid(
  config: HermesConfig,
  input: DiagramGenerationInput
): AsyncGenerator<DiagramStreamEvent> {
  const messages = buildDiagramMessages(input);
  let accumulated = '';
  let lastPreview: string | null = null;

  try {
    for await (const delta of streamHermes(config, messages, { temperature: 0.2 })) {
      accumulated += delta;
      const preview = extractPartialMermaid(accumulated);
      if (preview && preview !== lastPreview) {
        lastPreview = preview;
        yield { type: 'preview', mermaid: preview };
      }
    }

    const finalMermaid = sanitizeMermaidSource(accumulated);
    if (!finalMermaid) {
      yield { type: 'error', error: 'Diagram agent returned empty output' };
      return;
    }

    yield { type: 'done', mermaid: finalMermaid };
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Diagram stream failed',
    };
  }
}

export function encodeDiagramSse(event: DiagramStreamEvent): string {
  const name =
    event.type === 'preview' ? 'preview' : event.type === 'done' ? 'done' : 'error';
  return `event: ${name}\ndata: ${JSON.stringify(event)}\n\n`;
}