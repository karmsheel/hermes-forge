/**
 * Parse ```forge-graph``` fences from assistant text into GraphPatch ops.
 * Used by plant auto-apply (Phase 8.5) — conversation expands the living graph.
 */

import { parseJsonFromLlm } from "@/lib/hermes";
import type { GraphEdge, GraphNode, GraphPatchOp } from "./types";
import { isGraphEdgeKind, isGraphNodeKind } from "./types";

export const FORGE_GRAPH_FENCE = "forge-graph";

const GRAPH_FENCE_RE = /```forge-graph\s*\n([\s\S]*?)```/gi;

/** Max ops accepted from a single assistant message (DoS / bad model guard). */
export const FORGE_GRAPH_MAX_OPS = 80;

/**
 * Coerce a single raw op object into a GraphPatchOp, or null if invalid.
 */
export function coerceGraphPatchOp(raw: unknown): GraphPatchOp | null {
  if (!raw || typeof raw !== "object") return null;
  const op = (raw as { op?: string }).op;
  if (op === "upsert_node") {
    const node = (raw as { node?: unknown }).node;
    if (!node || typeof node !== "object") return null;
    const n = node as Record<string, unknown>;
    if (typeof n.id !== "string" || !n.id.trim()) return null;
    if (typeof n.name !== "string" || !n.name.trim()) return null;
    if (!isGraphNodeKind(n.kind)) return null;
    const out: GraphNode = {
      id: n.id.trim().slice(0, 120),
      kind: n.kind,
      name: n.name.trim().slice(0, 200),
      parentId:
        n.parentId === null || n.parentId === undefined
          ? null
          : typeof n.parentId === "string"
            ? n.parentId.trim().slice(0, 120)
            : null,
      description:
        typeof n.description === "string"
          ? n.description.slice(0, 2000)
          : null,
      props:
        n.props && typeof n.props === "object"
          ? (n.props as Record<string, unknown>)
          : undefined,
      position:
        n.position &&
        typeof n.position === "object" &&
        typeof (n.position as { x?: unknown }).x === "number" &&
        typeof (n.position as { y?: unknown }).y === "number"
          ? {
              x: (n.position as { x: number }).x,
              y: (n.position as { y: number }).y,
            }
          : null,
    };
    return { op: "upsert_node", node: out };
  }
  if (op === "delete_node" && typeof (raw as { id?: unknown }).id === "string") {
    const id = (raw as { id: string }).id.trim();
    if (!id) return null;
    return { op: "delete_node", id: id.slice(0, 120) };
  }
  if (op === "upsert_edge") {
    const edge = (raw as { edge?: unknown }).edge;
    if (!edge || typeof edge !== "object") return null;
    const e = edge as Record<string, unknown>;
    if (
      typeof e.id !== "string" ||
      typeof e.fromId !== "string" ||
      typeof e.toId !== "string" ||
      !isGraphEdgeKind(e.kind)
    ) {
      return null;
    }
    const out: GraphEdge = {
      id: e.id.trim().slice(0, 160),
      kind: e.kind,
      fromId: e.fromId.trim().slice(0, 120),
      toId: e.toId.trim().slice(0, 120),
      label: typeof e.label === "string" ? e.label.slice(0, 200) : null,
    };
    if (!out.id || !out.fromId || !out.toId) return null;
    return { op: "upsert_edge", edge: out };
  }
  if (op === "delete_edge" && typeof (raw as { id?: unknown }).id === "string") {
    const id = (raw as { id: string }).id.trim();
    if (!id) return null;
    return { op: "delete_edge", id: id.slice(0, 160) };
  }
  if (op === "set_position") {
    const id = (raw as { id?: unknown }).id;
    const position = (raw as { position?: unknown }).position;
    if (typeof id !== "string" || !id.trim()) return null;
    if (!position || typeof position !== "object") return null;
    const x = (position as { x?: unknown }).x;
    const y = (position as { y?: unknown }).y;
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      op: "set_position",
      id: id.trim().slice(0, 120),
      position: { x, y },
    };
  }
  return null;
}

function coerceOpsArray(raw: unknown): GraphPatchOp[] {
  if (Array.isArray(raw)) {
    return raw
      .map(coerceGraphPatchOp)
      .filter((x): x is GraphPatchOp => Boolean(x));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.ops)) {
      return coerceOpsArray(obj.ops);
    }
    // Single op object
    const one = coerceGraphPatchOp(raw);
    return one ? [one] : [];
  }
  return [];
}

/**
 * Extract all GraphPatchOps from ```forge-graph``` fences in assistant text.
 */
export function parseForgeGraphFence(
  text: string | null | undefined,
): GraphPatchOp[] {
  if (!text?.trim()) return [];
  const collected: GraphPatchOp[] = [];
  const re = new RegExp(GRAPH_FENCE_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      collected.push(...coerceOpsArray(parsed));
    } catch {
      try {
        const parsed = parseJsonFromLlm(body);
        collected.push(...coerceOpsArray(parsed));
      } catch {
        /* skip bad fence */
      }
    }
  }
  // Dedupe consecutive identical stringify? Keep order; cap length.
  return collected.slice(0, FORGE_GRAPH_MAX_OPS);
}

export function hasForgeGraphFence(text: string | null | undefined): boolean {
  return Boolean(text && /```forge-graph/i.test(text));
}

/** Prompt snippet for Overlord / Map studio (Phase 8.5). */
export function forgeGraphPromptAddon(): string {
  return [
    "Business graph tool — prefer modeling units, capabilities, processes, and steps on the living graph (not only process drafts).",
    "When the user describes org structure, channels, capabilities, handoffs, or process steps, end your reply with a forge-graph fence. The server auto-applies ops to local Business.graphJson:",
    "```forge-graph",
    JSON.stringify(
      [
        {
          op: "upsert_node",
          node: {
            id: "unit_marketing",
            kind: "unit",
            name: "Marketing",
            parentId: null,
            description: "Growth channels",
          },
        },
        {
          op: "upsert_node",
          node: {
            id: "cap_social",
            kind: "capability",
            name: "Social distribution",
            parentId: "unit_marketing",
          },
        },
        {
          op: "upsert_edge",
          edge: {
            id: "contains_unit_marketing_cap_social",
            kind: "contains",
            fromId: "unit_marketing",
            toId: "cap_social",
          },
        },
      ],
      null,
      0,
    ),
    "```",
    "Ops: upsert_node | delete_node | upsert_edge | delete_edge | set_position.",
    "Node kinds: business | unit | capability | process | step.",
    "Edge kinds: contains | flows_to | feeds.",
    "Rules:",
    "- Use stable ids (slug-like). Re-upsert updates by id.",
    "- Prefer unit → capability → process → step via parentId + contains edges.",
    "- On Map, expand process depth with kind step + flows_to between steps.",
    "- Only model what the user described. Prefer 3–12 nodes per turn over huge dumps.",
    "- You may still use forge-drafts for Process table rows / plant blocks when needed; forge-graph is the structural twin.",
    "- Omit the fence when only answering without writing graph data.",
  ].join("\n");
}

/** Compact graph summary lines for studio page context. */
export function summarizeGraphForContext(
  graph: {
    nodes: Array<{
      id: string;
      kind: string;
      name: string;
      parentId?: string | null;
    }>;
    edges: Array<{ kind: string; fromId: string; toId: string }>;
  } | null,
  maxNodes = 24,
): string[] {
  if (!graph || graph.nodes.length === 0) {
    return [
      "Business graph: empty — seed from conversation with forge-graph or reseed from legacy processes.",
    ];
  }
  const counts = new Map<string, number>();
  for (const n of graph.nodes) {
    counts.set(n.kind, (counts.get(n.kind) || 0) + 1);
  }
  const mix = [...counts.entries()]
    .map(([k, n]) => `${k}=${n}`)
    .join(", ");
  const lines = [
    `Business graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges (${mix})`,
    "Graph nodes (sample):",
  ];
  const ordered = [...graph.nodes].sort((a, b) => {
    const order = ["business", "unit", "capability", "process", "step"];
    return order.indexOf(a.kind) - order.indexOf(b.kind);
  });
  for (const n of ordered.slice(0, maxNodes)) {
    lines.push(
      `- [${n.kind}] ${n.name} id=${n.id}` +
        (n.parentId ? ` parent=${n.parentId}` : ""),
    );
  }
  if (graph.nodes.length > maxNodes) {
    lines.push(`… +${graph.nodes.length - maxNodes} more nodes`);
  }
  return lines;
}
