/**
 * Business graph document types (PRODUCT_VISION / LIVING_BUSINESS_MAP).
 * Local-first JSON on Business.graphJson — not a cloud graph DB.
 */

export const GRAPH_DOC_VERSION = 1 as const;

/** Hierarchy + flow kinds for MVP; metrics/automations later. */
export const GRAPH_NODE_KINDS = [
  "business",
  "unit",
  "capability",
  "process",
  "step",
] as const;

export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

export const GRAPH_EDGE_KINDS = ["contains", "flows_to", "feeds"] as const;

export type GraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number];

export type GraphPosition = { x: number; y: number };

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  name: string;
  /** Parent for contains hierarchy (unit→capability→process→step). */
  parentId?: string | null;
  description?: string | null;
  props?: Record<string, unknown>;
  position?: GraphPosition | null;
};

export type GraphEdge = {
  id: string;
  kind: GraphEdgeKind;
  fromId: string;
  toId: string;
  label?: string | null;
};

export type BusinessGraph = {
  version: typeof GRAPH_DOC_VERSION | number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt?: string;
};

export type GraphPatchOp =
  | { op: "upsert_node"; node: GraphNode }
  | { op: "delete_node"; id: string }
  | { op: "upsert_edge"; edge: GraphEdge }
  | { op: "delete_edge"; id: string }
  | {
      op: "set_position";
      id: string;
      position: GraphPosition;
    };

export type GraphPatch = {
  ops: GraphPatchOp[];
};

export function emptyBusinessGraph(): BusinessGraph {
  return {
    version: GRAPH_DOC_VERSION,
    nodes: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

export function isGraphNodeKind(value: unknown): value is GraphNodeKind {
  return (
    typeof value === "string" &&
    (GRAPH_NODE_KINDS as readonly string[]).includes(value)
  );
}

export function isGraphEdgeKind(value: unknown): value is GraphEdgeKind {
  return (
    typeof value === "string" &&
    (GRAPH_EDGE_KINDS as readonly string[]).includes(value)
  );
}
