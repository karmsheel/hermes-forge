import {
  emptyBusinessGraph,
  isGraphEdgeKind,
  isGraphNodeKind,
  type BusinessGraph,
  type GraphEdge,
  type GraphNode,
  type GraphPosition,
  GRAPH_DOC_VERSION,
} from "./types";

function parsePosition(raw: unknown): GraphPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const x = (raw as { x?: unknown }).x;
  const y = (raw as { y?: unknown }).y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function parseNode(raw: unknown): GraphNode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  if (!isGraphNodeKind(o.kind)) return null;
  if (typeof o.name !== "string" || !o.name.trim()) return null;
  const parentId =
    o.parentId === null || o.parentId === undefined
      ? null
      : typeof o.parentId === "string"
        ? o.parentId
        : null;
  return {
    id: o.id,
    kind: o.kind,
    name: o.name.trim(),
    parentId,
    description:
      typeof o.description === "string" ? o.description : null,
    props:
      o.props && typeof o.props === "object" && !Array.isArray(o.props)
        ? (o.props as Record<string, unknown>)
        : undefined,
    position: parsePosition(o.position),
  };
}

function parseEdge(raw: unknown): GraphEdge | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  if (!isGraphEdgeKind(o.kind)) return null;
  if (typeof o.fromId !== "string" || typeof o.toId !== "string") return null;
  return {
    id: o.id,
    kind: o.kind,
    fromId: o.fromId,
    toId: o.toId,
    label: typeof o.label === "string" ? o.label : null,
  };
}

/** Parse graphJson string or object; returns empty graph on null/invalid. */
export function parseBusinessGraph(raw: string | null | undefined): BusinessGraph {
  if (!raw?.trim()) return emptyBusinessGraph();
  try {
    const data = JSON.parse(raw) as unknown;
    return normalizeBusinessGraph(data);
  } catch {
    return emptyBusinessGraph();
  }
}

export function normalizeBusinessGraph(data: unknown): BusinessGraph {
  if (!data || typeof data !== "object") return emptyBusinessGraph();
  const o = data as Record<string, unknown>;
  const nodesRaw = Array.isArray(o.nodes) ? o.nodes : [];
  const edgesRaw = Array.isArray(o.edges) ? o.edges : [];
  const nodes: GraphNode[] = [];
  const seen = new Set<string>();
  for (const n of nodesRaw) {
    const node = parseNode(n);
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();
  for (const e of edgesRaw) {
    const edge = parseEdge(e);
    if (!edge || edgeSeen.has(edge.id)) continue;
    if (!seen.has(edge.fromId) || !seen.has(edge.toId)) continue;
    edgeSeen.add(edge.id);
    edges.push(edge);
  }
  const version =
    typeof o.version === "number" && Number.isFinite(o.version)
      ? o.version
      : GRAPH_DOC_VERSION;
  return {
    version,
    nodes,
    edges,
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export function serializeBusinessGraph(graph: BusinessGraph): string {
  return JSON.stringify({
    ...graph,
    version: GRAPH_DOC_VERSION,
    updatedAt: new Date().toISOString(),
  });
}
