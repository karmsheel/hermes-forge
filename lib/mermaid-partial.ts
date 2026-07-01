import { sanitizeMermaidSource } from './mermaid-sanitize';

const DIAGRAM_HEADER = /^\s*(flowchart|graph)\s+/i;

function lineLooksComplete(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('%%')) return true;
  if (DIAGRAM_HEADER.test(trimmed)) return true;
  if (/^subgraph\s/i.test(trimmed)) return true;
  if (/^end\s*$/i.test(trimmed)) return true;
  if (/^(class|classDef|style|linkStyle)\s/i.test(trimmed)) return true;
  if (/-->|---|-.->|==>/.test(trimmed)) {
    return !/(?:-->|---|-.->|==>)\s*$/.test(trimmed);
  }
  return /[\])}]$/.test(trimmed);
}

/**
 * Best-effort Mermaid source from an in-progress LLM stream.
 * Drops the trailing incomplete line so Mermaid can render partial diagrams.
 */
export function extractPartialMermaid(raw: string): string | null {
  const sanitized = sanitizeMermaidSource(raw);
  if (!sanitized) return null;

  const lines = sanitized.split('\n');
  if (!lines.some((line) => DIAGRAM_HEADER.test(line.trim()))) {
    return null;
  }

  const completeLines: string[] = [];
  for (const line of lines) {
    if (!lineLooksComplete(line)) break;
    completeLines.push(line);
  }

  const candidate = completeLines.join('\n').trim();
  if (!candidate || !DIAGRAM_HEADER.test(candidate.split('\n')[0]?.trim() ?? '')) {
    return null;
  }

  const nodeOrEdgeCount = completeLines.filter((line) => {
    const trimmed = line.trim();
    return trimmed && !DIAGRAM_HEADER.test(trimmed) && !trimmed.startsWith('%%');
  }).length;

  return nodeOrEdgeCount > 0 ? candidate : null;
}