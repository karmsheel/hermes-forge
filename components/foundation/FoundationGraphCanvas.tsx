"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import {
  ArrowRight,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { GraphKindNode } from "@/components/plant/spike/GraphKindNode";
import {
  countDescendantProcesses,
  projectFoundationGraph,
  type BusinessGraph,
  type GraphFlowNodeData,
  type GraphNode,
  type GraphNodeKind,
} from "@/lib/business-graph";

const nodeTypes: NodeTypes = {
  graphNode: GraphKindNode,
};

export type FoundationGraphCanvasProps = {
  graph: BusinessGraph | null;
  loading?: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onPositionCommit?: (id: string, x: number, y: number) => void;
  onReseed?: () => void;
  onOpenChat?: () => void;
  /** Open legacy Workshop for a process node id. */
  onOpenWorkshop?: (processId: string) => void;
  /** Empty-state extras (templates, add draft). */
  emptyExtra?: ReactNode;
  /** When graph has only business root / no structure worth showing. */
  isStructurallyEmpty?: boolean;
};

function kindLabel(kind: GraphNodeKind): string {
  switch (kind) {
    case "business":
      return "Business";
    case "unit":
      return "Unit";
    case "capability":
      return "Capability";
    case "process":
      return "Process";
    case "step":
      return "Step";
    default:
      return kind;
  }
}

function SelectionInspector({
  graph,
  node,
  onClear,
  onOpenWorkshop,
}: {
  graph: BusinessGraph;
  node: GraphNode;
  onClear: () => void;
  onOpenWorkshop?: (processId: string) => void;
}) {
  const processCount = countDescendantProcesses(graph, node.id);
  const childCaps =
    node.kind === "unit"
      ? graph.nodes.filter((n) => n.kind === "capability" && n.parentId === node.id)
      : [];
  const childProcesses = graph.nodes.filter(
    (n) => n.kind === "process" && n.parentId === node.id,
  );
  const showMapCta =
    node.kind === "unit" ||
    node.kind === "capability" ||
    node.kind === "process" ||
    processCount > 0;

  return (
    <div className="shrink-0 border-t border-border bg-bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-text-muted">
            {kindLabel(node.kind)}
          </p>
          <h3
            className="text-sm font-semibold text-text-strong truncate"
            title={node.name}
          >
            {node.name}
          </h3>
          {node.description ? (
            <p className="text-xs text-text-muted mt-1 line-clamp-2">
              {node.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-text-muted">
            {(node.kind === "unit" ||
              node.kind === "capability" ||
              node.kind === "business") && (
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {processCount} process{processCount === 1 ? "" : "es"}
              </span>
            )}
            {childCaps.length > 0 ? (
              <span>
                {childCaps.length} capabilit
                {childCaps.length === 1 ? "y" : "ies"}
              </span>
            ) : null}
            {childProcesses.length > 0 && node.kind === "capability" ? (
              <span>
                {childProcesses.length} direct process
                {childProcesses.length === 1 ? "" : "es"}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-text-muted hover:text-text shrink-0"
        >
          Clear
        </button>
      </div>
      {showMapCta ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/god-mode"
            className="btn-primary text-xs inline-flex items-center gap-1.5"
            title="Open Map plant (process overview)"
          >
            Open Map
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          {node.kind === "process" && onOpenWorkshop ? (
            <button
              type="button"
              onClick={() => onOpenWorkshop(node.id)}
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              Workshop (legacy)
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-text-faint">
          Talk with Overlord to add capabilities and processes under this unit.
        </p>
      )}
    </div>
  );
}

function FoundationGraphCanvasInner({
  graph,
  loading,
  selectedNodeId,
  onSelectNode,
  onPositionCommit,
  onReseed,
  onOpenChat,
  onOpenWorkshop,
  emptyExtra,
  isStructurallyEmpty,
}: FoundationGraphCanvasProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node<GraphFlowNodeData>[]>([]);
  const [edges, setEdges] = useState<
    ReturnType<typeof projectFoundationGraph>["edges"]
  >([]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [graph, selectedNodeId]);

  useEffect(() => {
    if (!graph) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const projected = projectFoundationGraph(graph);
    setNodes(
      projected.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    );
    setEdges(projected.edges);
  }, [graph, selectedNodeId]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.18, duration: 220 });
    });
    return () => cancelAnimationFrame(t);
  }, [graph?.updatedAt, fitView, nodes.length]);

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(
      (nds) => applyNodeChanges(changes, nds) as Node<GraphFlowNodeData>[],
    );
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      onPositionCommit?.(node.id, node.position.x, node.position.y);
    },
    [onPositionCommit],
  );

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: sel }) => {
      const id = sel[0]?.id ?? null;
      onSelectNode(id);
    },
    [onSelectNode],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-text-muted min-h-[280px]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading business graph…
      </div>
    );
  }

  const empty =
    !graph ||
    graph.nodes.length === 0 ||
    isStructurallyEmpty === true ||
    // Business-only root with no units/caps is still "talk first"
    !graph.nodes.some(
      (n) => n.kind === "unit" || n.kind === "capability" || n.kind === "process",
    );

  if (empty) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[280px]">
        <div className="max-w-lg text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bg-elevated border border-border text-text-muted">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-strong">
              Model the business in conversation
            </h2>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Talk with <strong className="text-text font-medium">Overlord</strong>{" "}
              about units, capabilities, and how work flows. The graph fills in
              from that conversation — you do not need to draw first or open
              Workshop to have a Foundation model.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onOpenChat ? (
              <button
                type="button"
                onClick={onOpenChat}
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Chat with Overlord
              </button>
            ) : null}
            {onReseed ? (
              <button
                type="button"
                onClick={onReseed}
                className="btn-secondary text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Seed from existing data
              </button>
            ) : null}
          </div>
          {emptyExtra}
        </div>
      </div>
    );
  }

  const unitCount = graph.nodes.filter((n) => n.kind === "unit").length;
  const capCount = graph.nodes.filter((n) => n.kind === "capability").length;
  const processCount = graph.nodes.filter((n) => n.kind === "process").length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-text-strong">
            System graph
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {unitCount} unit{unitCount === 1 ? "" : "s"}
            {" · "}
            {capCount} capabilit{capCount === 1 ? "y" : "ies"}
            {" · "}
            {processCount} process{processCount === 1 ? "" : "es"}
            {" · "}
            drag to arrange · local graphJson
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onReseed ? (
            <button
              type="button"
              onClick={onReseed}
              className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-bg-panel text-text-muted hover:bg-bg-subtle"
              title="Rebuild graph from functions and processes (keeps structure, resets layout if nodes change)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reseed
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 border-t border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-bg"
          nodesDraggable
          elementsSelectable
          selectNodesOnDrag={false}
        >
          <Background gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap
            className="!bg-bg-panel !border-border"
            maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
          />
        </ReactFlow>
      </div>

      {selectedNode && graph ? (
        <SelectionInspector
          graph={graph}
          node={selectedNode}
          onClear={() => onSelectNode(null)}
          onOpenWorkshop={onOpenWorkshop}
        />
      ) : null}
    </div>
  );
}

export function FoundationGraphCanvas(props: FoundationGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <FoundationGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
