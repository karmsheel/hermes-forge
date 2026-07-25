/**
 * Project business graph → xyflow nodes/edges for Foundation / Map views.
 */

import type { Edge, Node } from "@xyflow/react";
import type { BusinessGraph, GraphNode, GraphNodeKind } from "./types";

export type GraphFlowNodeData = {
  graphNodeId: string;
  kind: GraphNodeKind;
  name: string;
  description?: string | null;
  status?: string;
  /** Descendant process nodes (unit/capability); 1 for process nodes. */
  processCount?: number;
};

export type ProjectGraphView = "foundation" | "map-steps";

const KIND_SIZE: Record<GraphNodeKind, { w: number; h: number }> = {
  business: { w: 200, h: 72 },
  unit: { w: 180, h: 96 },
  capability: { w: 168, h: 88 },
  process: { w: 176, h: 100 },
  step: { w: 140, h: 64 },
};

function childrenOf(graph: BusinessGraph, parentId: string): GraphNode[] {
  return graph.nodes.filter((n) => n.parentId === parentId);
}

/** Count process nodes under a hierarchy node (includes self if process). */
export function countDescendantProcesses(
  graph: BusinessGraph,
  nodeId: string,
): number {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  if (node.kind === "process") return 1;
  let count = 0;
  for (const child of childrenOf(graph, nodeId)) {
    count += countDescendantProcesses(graph, child.id);
  }
  return count;
}

function layoutTree(
  graph: BusinessGraph,
  rootIds: string[],
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const colGap = 220;
  const rowGap = 120;
  let col = 0;

  function place(id: string, depth: number, rowRef: { row: number }) {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    if (node.position) {
      pos.set(id, { x: node.position.x, y: node.position.y });
    } else {
      pos.set(id, { x: depth * colGap + 40, y: rowRef.row * rowGap + 40 });
      rowRef.row += 1;
    }
    const kids = childrenOf(graph, id).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const k of kids) {
      place(k.id, depth + 1, rowRef);
    }
  }

  for (const rootId of rootIds) {
    const rowRef = { row: 0 };
    place(rootId, col, rowRef);
    col += 1;
  }

  // Fallback grid for orphans
  let orphanY = 0;
  for (const n of graph.nodes) {
    if (pos.has(n.id)) continue;
    if (n.position) {
      pos.set(n.id, n.position);
      continue;
    }
    pos.set(n.id, { x: 40, y: 400 + orphanY * rowGap });
    orphanY += 1;
  }

  return pos;
}

/**
 * Foundation view: business + units + capabilities (+ optional process chips).
 */
export function projectFoundationGraph(graph: BusinessGraph): {
  nodes: Node<GraphFlowNodeData>[];
  edges: Edge[];
} {
  const kinds = new Set<GraphNodeKind>(["business", "unit", "capability"]);
  const include = graph.nodes.filter((n) => kinds.has(n.kind));
  const ids = new Set(include.map((n) => n.id));

  // Also show processes as light presence under capabilities
  const processes = graph.nodes.filter(
    (n) => n.kind === "process" && n.parentId && ids.has(n.parentId),
  );
  for (const p of processes) {
    include.push(p);
    ids.add(p.id);
  }

  const roots = include.filter((n) => n.kind === "business").map((n) => n.id);
  const rootIds =
    roots.length > 0
      ? roots
      : include.filter((n) => n.kind === "unit").map((n) => n.id);

  const pos = layoutTree({ ...graph, nodes: include }, rootIds);

  const nodes: Node<GraphFlowNodeData>[] = include.map((n) => {
    const size = KIND_SIZE[n.kind];
    const p = pos.get(n.id) ?? { x: 0, y: 0 };
    const processCount =
      n.kind === "unit" || n.kind === "capability" || n.kind === "business"
        ? countDescendantProcesses(graph, n.id)
        : n.kind === "process"
          ? 1
          : 0;
    return {
      id: n.id,
      type: "graphNode",
      position: p,
      data: {
        graphNodeId: n.id,
        kind: n.kind,
        name: n.name,
        description: n.description,
        status:
          typeof n.props?.status === "string" ? n.props.status : undefined,
        processCount,
      },
      style: { width: size.w, height: size.h },
    };
  });

  const edges: Edge[] = graph.edges
    .filter((e) => ids.has(e.fromId) && ids.has(e.toId))
    .map((e) => ({
      id: e.id,
      source: e.fromId,
      target: e.toId,
      type: "smoothstep",
      label: e.label ?? undefined,
      data: { kind: e.kind },
      style: {
        stroke:
          e.kind === "contains"
            ? "var(--border-strong)"
            : "var(--text-muted)",
        strokeDasharray: e.kind === "contains" ? "4 4" : undefined,
      },
      markerEnd:
        e.kind === "flows_to" || e.kind === "feeds"
          ? {
              type: "arrowclosed" as const,
              color: "var(--text-muted)",
              width: 14,
              height: 14,
            }
          : undefined,
    }));

  return { nodes, edges };
}

/**
 * Map step view: steps under a process, plus process node, flows_to between steps.
 */
export function projectProcessStepGraph(
  graph: BusinessGraph,
  processId: string,
): { nodes: Node<GraphFlowNodeData>[]; edges: Edge[] } {
  const process = graph.nodes.find(
    (n) => n.id === processId && n.kind === "process",
  );
  if (!process) return { nodes: [], edges: [] };

  const steps = graph.nodes.filter(
    (n) => n.kind === "step" && n.parentId === processId,
  );
  const include = [process, ...steps];
  const ids = new Set(include.map((n) => n.id));
  const pos = layoutTree({ ...graph, nodes: include }, [processId]);

  const nodes: Node<GraphFlowNodeData>[] = include.map((n) => {
    const size = KIND_SIZE[n.kind];
    return {
      id: n.id,
      type: "graphNode",
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: {
        graphNodeId: n.id,
        kind: n.kind,
        name: n.name,
        description: n.description,
        status:
          typeof n.props?.status === "string" ? n.props.status : undefined,
      },
      style: { width: size.w, height: size.h },
    };
  });

  const edges: Edge[] = graph.edges
    .filter(
      (e) =>
        ids.has(e.fromId) &&
        ids.has(e.toId) &&
        (e.kind === "flows_to" || e.kind === "contains"),
    )
    .map((e) => ({
      id: e.id,
      source: e.fromId,
      target: e.toId,
      type: "smoothstep",
      label: e.label ?? undefined,
      data: { kind: e.kind },
      style: { stroke: "var(--text-muted)" },
      markerEnd: {
        type: "arrowclosed" as const,
        color: "var(--text-muted)",
        width: 14,
        height: 14,
      },
    }));

  return { nodes, edges };
}
