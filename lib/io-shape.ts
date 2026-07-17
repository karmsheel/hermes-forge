/**
 * Process I/O shape library (Phase 6.1).
 *
 * Closed set of black-box topologies for overview UI and agent language.
 * Shape counts **process-boundary** inputs/outputs — not internal flowchart branches.
 */

import { parseMermaidGraph } from '@/lib/mermaid-graph';

export const IO_SHAPE_IDS = ['siso', 'simo', 'miso', 'mimo'] as const;

export type IoShapeId = (typeof IO_SHAPE_IDS)[number];

export const DEFAULT_IO_SHAPE: IoShapeId = 'siso';

export interface IoShapeMeta {
  id: IoShapeId;
  /** Short UI label */
  label: string;
  /** Glyph hint (text fallback when SVG not used) */
  glyph: string;
  /** One-line meaning for agents and tooltips */
  meaning: string;
}

export const IO_SHAPE_META: Record<IoShapeId, IoShapeMeta> = {
  siso: {
    id: 'siso',
    label: 'Single in, single out',
    glyph: '→ □ →',
    meaning: 'Linear unit / pipeline step',
  },
  simo: {
    id: 'simo',
    label: 'Single in, multi out',
    glyph: '→ □ ⇉',
    meaning: 'Split / fan-out / distribute',
  },
  miso: {
    id: 'miso',
    label: 'Multi in, single out',
    glyph: '⇉ □ →',
    meaning: 'Merge / assemble / consolidate',
  },
  mimo: {
    id: 'mimo',
    label: 'Multi in, multi out',
    glyph: '⇉ □ ⇉',
    meaning: 'Hub / exchange / multi-feed multi-product',
  },
};

export function isIoShapeId(value: unknown): value is IoShapeId {
  return typeof value === 'string' && (IO_SHAPE_IDS as readonly string[]).includes(value);
}

export function normalizeIoShape(value: unknown): IoShapeId {
  return isIoShapeId(value) ? value : DEFAULT_IO_SHAPE;
}

export function getIoShapeMeta(id: unknown): IoShapeMeta {
  return IO_SHAPE_META[normalizeIoShape(id)];
}

/**
 * Split free-text inputs/outputs into ordered, de-duplicated labels.
 * Supports newlines, bullets, semicolons, " + ", and commas.
 */
export function listBoundaryItems(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];

  const parts = text
    .split(/\r?\n|;|\s+\+\s+|,\s*|(?:^|\n)\s*[-*•]\s+/)
    .map((p) => p.replace(/^[-*•]\s+/, '').trim())
    .filter((p) => p.length > 0 && !/^(none|n\/a|na|-)$/i.test(p));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Count unique boundary labels in free-text inputs/outputs. */
export function countBoundaryItems(text: string | null | undefined): number {
  return listBoundaryItems(text).length;
}

export function shapeFromCounts(inCount: number, outCount: number): IoShapeId {
  const multiIn = inCount >= 2;
  const multiOut = outCount >= 2;
  if (multiIn && multiOut) return 'mimo';
  if (multiIn) return 'miso';
  if (multiOut) return 'simo';
  return 'siso';
}

/**
 * Best-effort boundary counts from Mermaid: sources (in-degree 0) and sinks
 * (out-degree 0). Do not use stadium "start-like" style alone — ends often use
 * the same shape. Internal branches that merge back share one sink.
 */
export function boundaryCountsFromMermaid(
  source: string | null | undefined
): { inCount: number; outCount: number } | null {
  const graph = parseMermaidGraph(source);
  if (!graph || graph.nodes.size < 2) return null;

  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const id of graph.nodes.keys()) {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }
  for (const e of graph.edges) {
    if (!graph.nodes.has(e.from) || !graph.nodes.has(e.to)) continue;
    outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  // Isolated single nodes with no edges don't define a boundary
  if (graph.edges.length === 0) return null;

  let sources = 0;
  let sinks = 0;
  for (const id of graph.nodes.keys()) {
    const indeg = inDegree.get(id) ?? 0;
    const outdeg = outDegree.get(id) ?? 0;
    if (indeg === 0) sources += 1;
    if (outdeg === 0) sinks += 1;
  }

  return {
    inCount: Math.max(1, sources || 1),
    outCount: Math.max(1, sinks || 1),
  };
}

export interface DeriveIoShapeInput {
  inputs?: string | null;
  outputs?: string | null;
  diagramMermaid?: string | null;
  /** When set and valid, wins (manual / agent pin) */
  explicit?: string | null;
}

/**
 * Derive I/O shape from structured fields, then Mermaid boundary, else siso.
 * Explicit value wins when valid.
 */
export function deriveIoShape(input: DeriveIoShapeInput): IoShapeId {
  if (input.explicit != null && isIoShapeId(input.explicit)) {
    return input.explicit;
  }

  const inFromField = countBoundaryItems(input.inputs);
  const outFromField = countBoundaryItems(input.outputs);

  if (inFromField > 0 || outFromField > 0) {
    // Unspecified side defaults to single (1) when the other is known
    const inCount = inFromField > 0 ? inFromField : 1;
    const outCount = outFromField > 0 ? outFromField : 1;
    return shapeFromCounts(inCount, outCount);
  }

  const fromDiagram = boundaryCountsFromMermaid(input.diagramMermaid);
  if (fromDiagram) {
    return shapeFromCounts(fromDiagram.inCount, fromDiagram.outCount);
  }

  return DEFAULT_IO_SHAPE;
}

/** Prisma-friendly patch fragment for create/update paths. */
export function ioShapeWriteData(input: DeriveIoShapeInput): { ioShape: IoShapeId } {
  return { ioShape: deriveIoShape(input) };
}

/**
 * Compact system-prompt block so Hermes can speak about shapes during mapping.
 */
export function ioShapePromptAddon(currentShape?: string | null): string {
  const current = normalizeIoShape(currentShape);
  const meta = IO_SHAPE_META[current];
  const catalog = IO_SHAPE_IDS.map((id) => {
    const m = IO_SHAPE_META[id];
    return `- \`${id}\` (${m.glyph}) — ${m.label}: ${m.meaning}`;
  }).join('\n');

  return `Process I/O shape (black-box interface — external feeds/products only, not internal branches):
Current shape: \`${current}\` (${meta.glyph}) — ${meta.label}.
Library:
${catalog}
Prefer thinking in these shapes when summarizing the process boundary. The app may recompute shape from inputs/outputs and diagram ends; you do not need to output shape codes unless the user asks.`;
}
