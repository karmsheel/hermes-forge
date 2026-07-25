import type {
  BusinessGraph,
  GraphEdge,
  GraphNode,
  GraphPatch,
  GraphPatchOp,
} from "./types";

export type ApplyPatchResult = {
  graph: BusinessGraph;
  applied: number;
  errors: string[];
};

function upsertNode(nodes: GraphNode[], node: GraphNode): GraphNode[] {
  const i = nodes.findIndex((n) => n.id === node.id);
  if (i === -1) return [...nodes, node];
  const next = nodes.slice();
  next[i] = { ...nodes[i], ...node, id: node.id };
  return next;
}

function upsertEdge(edges: GraphEdge[], edge: GraphEdge): GraphEdge[] {
  const i = edges.findIndex((e) => e.id === edge.id);
  if (i === -1) return [...edges, edge];
  const next = edges.slice();
  next[i] = { ...edges[i], ...edge, id: edge.id };
  return next;
}

/**
 * Apply a list of ops immutably. Drops edges that reference missing nodes.
 */
export function applyGraphPatch(
  graph: BusinessGraph,
  patch: GraphPatch,
): ApplyPatchResult {
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];
  const errors: string[] = [];
  let applied = 0;

  for (const op of patch.ops ?? []) {
    const result = applyOne(nodes, edges, op);
    nodes = result.nodes;
    edges = result.edges;
    if (result.error) {
      errors.push(result.error);
    } else {
      applied += 1;
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId));

  return {
    graph: {
      version: graph.version,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
    applied,
    errors,
  };
}

function applyOne(
  nodes: GraphNode[],
  edges: GraphEdge[],
  op: GraphPatchOp,
): { nodes: GraphNode[]; edges: GraphEdge[]; error?: string } {
  switch (op.op) {
    case "upsert_node": {
      if (!op.node?.id || !op.node.name?.trim()) {
        return { nodes, edges, error: "upsert_node requires id and name" };
      }
      return { nodes: upsertNode(nodes, op.node), edges };
    }
    case "delete_node": {
      if (!op.id) return { nodes, edges, error: "delete_node requires id" };
      return {
        nodes: nodes.filter((n) => n.id !== op.id),
        edges: edges.filter((e) => e.fromId !== op.id && e.toId !== op.id),
      };
    }
    case "upsert_edge": {
      if (!op.edge?.id || !op.edge.fromId || !op.edge.toId) {
        return { nodes, edges, error: "upsert_edge requires id, fromId, toId" };
      }
      const ids = new Set(nodes.map((n) => n.id));
      if (!ids.has(op.edge.fromId) || !ids.has(op.edge.toId)) {
        return {
          nodes,
          edges,
          error: `upsert_edge endpoints missing for ${op.edge.id}`,
        };
      }
      return { nodes, edges: upsertEdge(edges, op.edge) };
    }
    case "delete_edge": {
      if (!op.id) return { nodes, edges, error: "delete_edge requires id" };
      return { nodes, edges: edges.filter((e) => e.id !== op.id) };
    }
    case "set_position": {
      if (!op.id || !op.position) {
        return { nodes, edges, error: "set_position requires id and position" };
      }
      const i = nodes.findIndex((n) => n.id === op.id);
      if (i === -1) {
        return { nodes, edges, error: `set_position unknown node ${op.id}` };
      }
      const next = nodes.slice();
      next[i] = { ...nodes[i]!, position: op.position };
      return { nodes: next, edges };
    }
    default:
      return { nodes, edges, error: "unknown op" };
  }
}
