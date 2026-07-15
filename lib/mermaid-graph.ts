/**
 * Lightweight Mermaid flowchart graph analysis for process-split detection.
 * Deterministic (no LLM): parse nodes/edges → connected components → split eligibility.
 */

export type SplitConfidence = 'high' | 'medium' | 'low' | 'none';

export interface MermaidGraphNode {
  id: string;
  label: string;
  /** Stadium / rounded start style: id([Label]) */
  isStartLike: boolean;
}

export interface MermaidGraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface MermaidGraph {
  header: string;
  nodes: Map<string, MermaidGraphNode>;
  edges: MermaidGraphEdge[];
}

export interface SplitComponent {
  id: string;
  nodeIds: string[];
  labels: string[];
  startLabels: string[];
  /** Best-effort name from first start-like or first node label */
  suggestedName: string;
}

export interface SplitAnalysis {
  canSplit: boolean;
  /** Show a primary "Split" affordance when true (high confidence only by default). */
  showSplitButton: boolean;
  confidence: SplitConfidence;
  reasons: string[];
  componentCount: number;
  components: SplitComponent[];
  nodeCount: number;
}

const HEADER_RE = /^\s*(flowchart|graph)\s+(TD|TB|BT|RL|LR)\b/i;
const EDGE_OP =
  /(?:-->|---|-.->|==>|--o|--x|o--|x--)/;

/** Strip edge label |...| segments for simpler parsing */
function stripEdgeLabels(line: string): string {
  return line.replace(/\|[^|\n]*\|/g, ' ');
}

/**
 * Extract node id + optional shape/label from a token like:
 * start([New lead]), qualify{Qualified?}, demo[Schedule demo], A, end_node
 */
function parseNodeToken(raw: string): MermaidGraphNode | null {
  const token = raw.trim();
  if (!token || token.startsWith('%%')) return null;

  // Stadium: id([label])
  let m = token.match(/^([A-Za-z][\w-]*)\s*\(\[([^\]]*)\]\)/);
  if (m) {
    return { id: m[1], label: cleanLabel(m[2]), isStartLike: true };
  }

  // Double circle / circle: id((label)) or id(( ))
  m = token.match(/^([A-Za-z][\w-]*)\s*\(\(([^)]*)\)\)/);
  if (m) {
    return { id: m[1], label: cleanLabel(m[2]), isStartLike: false };
  }

  // Diamond: id{label} or id{"label"}
  m = token.match(/^([A-Za-z][\w-]*)\s*\{+"?([^}"\n]*)"?\}/);
  if (m) {
    return { id: m[1], label: cleanLabel(m[2]), isStartLike: false };
  }

  // Rectangle: id[label] or id["label"]
  m = token.match(/^([A-Za-z][\w-]*)\s*\[+"?([^\]"\n]*)"?\]/);
  if (m) {
    return { id: m[1], label: cleanLabel(m[2]), isStartLike: false };
  }

  // Rounded: id(label) — not stadium
  m = token.match(/^([A-Za-z][\w-]*)\s*\((?!\[)([^)\n]*)\)/);
  if (m) {
    return { id: m[1], label: cleanLabel(m[2]), isStartLike: false };
  }

  // Bare id (edge endpoint)
  m = token.match(/^([A-Za-z][\w-]*)\s*$/);
  if (m) {
    return { id: m[1], label: m[1], isStartLike: false };
  }

  return null;
}

function cleanLabel(label: string): string {
  return label
    .replace(/^["']|["']$/g, '')
    .replace(/#quot;/g, '"')
    .trim();
}

function ensureNode(
  nodes: Map<string, MermaidGraphNode>,
  partial: MermaidGraphNode
): void {
  const existing = nodes.get(partial.id);
  if (!existing) {
    nodes.set(partial.id, partial);
    return;
  }
  // Prefer richer labels / start-like flags
  if (partial.label && (existing.label === existing.id || !existing.label)) {
    existing.label = partial.label;
  }
  if (partial.isStartLike) existing.isStartLike = true;
}

/**
 * Parse a Mermaid flowchart into a simple directed graph.
 * Best-effort for Forge-generated diagrams (not full Mermaid grammar).
 */
export function parseMermaidGraph(source: string | null | undefined): MermaidGraph | null {
  if (!source?.trim()) return null;

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let header = 'flowchart TD';
  const nodes = new Map<string, MermaidGraphNode>();
  const edges: MermaidGraphEdge[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^subgraph\b/i.test(line) || /^end\s*$/i.test(line)) continue;
    if (/^(class|classDef|style|linkStyle|direction)\b/i.test(line)) continue;

    if (HEADER_RE.test(line)) {
      header = line.replace(HEADER_RE, (_, type, dir) => `${String(type).toLowerCase()} ${String(dir).toUpperCase()}`);
      continue;
    }

    // Drop trailing comments
    const code = stripEdgeLabels(line.replace(/%%.*$/, '').trim());
    if (!code) continue;

    if (EDGE_OP.test(code)) {
      // Split on edge operators while keeping chain A --> B --> C
      const parts = code.split(/\s*(?:-->|---|-.->|==>|--o|--x|o--|x--)\s*/);
      const ids: string[] = [];
      for (const part of parts) {
        const node = parseNodeToken(part.trim());
        if (node) {
          ensureNode(nodes, node);
          ids.push(node.id);
        }
      }
      for (let i = 0; i < ids.length - 1; i++) {
        edges.push({ from: ids[i], to: ids[i + 1] });
      }
      continue;
    }

    // Standalone node definition
    const node = parseNodeToken(code);
    if (node) ensureNode(nodes, node);
  }

  if (nodes.size === 0) return null;
  return { header, nodes, edges };
}

/** Undirected connected components (ignores edge direction). */
export function connectedComponents(graph: MermaidGraph): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of graph.nodes.keys()) {
    adj.set(id, new Set());
  }
  for (const e of graph.edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  const seen = new Set<string>();
  const components: string[][] = [];

  for (const id of graph.nodes.keys()) {
    if (seen.has(id)) continue;
    const stack = [id];
    const comp: string[] = [];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of adj.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    components.push(comp);
  }

  // Larger components first
  components.sort((a, b) => b.length - a.length);
  return components;
}

function suggestName(labels: string[], startLabels: string[]): string {
  const seed = startLabels[0] || labels[0] || 'Workflow';
  const cleaned = seed
    .replace(/\?+$/, '')
    .replace(/^(start|begin|trigger)[:\s-]*/i, '')
    .trim();
  if (!cleaned) return 'Split workflow';
  // Title-case first ~6 words
  return cleaned
    .split(/\s+/)
    .slice(0, 6)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Analyze whether a Mermaid diagram looks like multiple independent workflows.
 *
 * High confidence: ≥2 undirected components each with ≥2 nodes (disconnected flows).
 * Medium: ≥2 components where at least one is a singleton, or multiple start-like
 * nodes with weak separation (v1: multiple starts in one component → medium, no button).
 */
export function analyzeSplitCandidates(
  source: string | null | undefined,
  options?: { minNodes?: number }
): SplitAnalysis {
  const minNodes = options?.minNodes ?? 4;
  const empty: SplitAnalysis = {
    canSplit: false,
    showSplitButton: false,
    confidence: 'none',
    reasons: [],
    componentCount: 0,
    components: [],
    nodeCount: 0,
  };

  const graph = parseMermaidGraph(source);
  if (!graph) {
    return { ...empty, reasons: ['No parseable Mermaid diagram.'] };
  }

  const nodeCount = graph.nodes.size;
  if (nodeCount < minNodes) {
    return {
      ...empty,
      nodeCount,
      reasons: [`Diagram is small (${nodeCount} nodes); split is rarely useful yet.`],
    };
  }

  const rawComps = connectedComponents(graph);
  // Ignore single-node isolates for "meaningful" multi-flow detection
  const meaningful = rawComps.filter((c) => c.length >= 2);
  const singletons = rawComps.filter((c) => c.length === 1);

  const components: SplitComponent[] = meaningful.map((nodeIds, index) => {
    const labels = nodeIds.map((id) => graph.nodes.get(id)?.label ?? id);
    const startLabels = nodeIds
      .filter((id) => graph.nodes.get(id)?.isStartLike)
      .map((id) => graph.nodes.get(id)!.label);
    // Also treat indegree-0 as starts for naming
    const indeg = new Map<string, number>();
    for (const id of nodeIds) indeg.set(id, 0);
    for (const e of graph.edges) {
      if (indeg.has(e.to) && indeg.has(e.from)) {
        indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
      }
    }
    for (const id of nodeIds) {
      if ((indeg.get(id) ?? 0) === 0) {
        const label = graph.nodes.get(id)?.label ?? id;
        if (!startLabels.includes(label)) startLabels.push(label);
      }
    }
    return {
      id: `flow-${index + 1}`,
      nodeIds,
      labels,
      startLabels,
      suggestedName: suggestName(labels, startLabels),
    };
  });

  const startLikeCount = Array.from(graph.nodes.values()).filter((n) => n.isStartLike).length;
  // Zero-indegree nodes across whole graph
  const indegree = new Map<string, number>();
  for (const id of graph.nodes.keys()) indegree.set(id, 0);
  for (const e of graph.edges) {
    if (indegree.has(e.to)) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  const zeroIn = Array.from(indegree.entries()).filter(([, d]) => d === 0).length;

  if (meaningful.length >= 2) {
    const reasons = [
      `Found ${meaningful.length} separate flows (${components.map((c) => c.suggestedName).join('; ')}).`,
      'Each flow can become its own process for automation.',
    ];
    if (singletons.length > 0) {
      reasons.push(`${singletons.length} isolated node(s) ignored for split grouping.`);
    }
    return {
      canSplit: true,
      showSplitButton: true,
      confidence: 'high',
      reasons,
      componentCount: meaningful.length,
      components,
      nodeCount,
    };
  }

  // Single connected graph with multiple stadium starts → medium (agent may propose; no button)
  if (startLikeCount >= 2 || zeroIn >= 3) {
    return {
      canSplit: true,
      showSplitButton: false,
      confidence: 'medium',
      reasons: [
        startLikeCount >= 2
          ? `Diagram has ${startLikeCount} start-style nodes in one connected graph — may be multiple triggers.`
          : `Diagram has ${zeroIn} entry points — may mix independent flows.`,
        'Review with Hermes before splitting; branches that rejoin are usually one process.',
      ],
      componentCount: 1,
      components:
        components.length > 0
          ? components
          : [
              {
                id: 'flow-1',
                nodeIds: Array.from(graph.nodes.keys()),
                labels: Array.from(graph.nodes.values()).map((n) => n.label),
                startLabels: Array.from(graph.nodes.values())
                  .filter((n) => n.isStartLike)
                  .map((n) => n.label),
                suggestedName: suggestName(
                  Array.from(graph.nodes.values()).map((n) => n.label),
                  Array.from(graph.nodes.values())
                    .filter((n) => n.isStartLike)
                    .map((n) => n.label)
                ),
              },
            ],
      nodeCount,
    };
  }

  return {
    canSplit: false,
    showSplitButton: false,
    confidence: 'none',
    reasons: ['Diagram looks like a single connected process.'],
    componentCount: meaningful.length || rawComps.length,
    components,
    nodeCount,
  };
}

/** Human-readable snippet for chat system prompts. */
export function formatSplitAnalysisForPrompt(analysis: SplitAnalysis): string {
  if (analysis.confidence === 'none' || !analysis.canSplit) {
    return '';
  }
  const lines = [
    'Structural split analysis (deterministic, from Mermaid graph):',
    `- confidence: ${analysis.confidence}`,
    `- canSplit: ${analysis.canSplit}`,
    ...analysis.reasons.map((r) => `- ${r}`),
  ];
  if (analysis.components.length > 0) {
    lines.push('Candidate flows:');
    for (const c of analysis.components) {
      lines.push(
        `  - ${c.suggestedName}: nodes [${c.nodeIds.slice(0, 12).join(', ')}${c.nodeIds.length > 12 ? ', …' : ''}]`
      );
    }
  }
  lines.push(
    'If the user confirms a split, the system can execute it (sidebar will gain a new workflow). Prefer proposing a clear split of independent flows.'
  );
  return lines.join('\n');
}
