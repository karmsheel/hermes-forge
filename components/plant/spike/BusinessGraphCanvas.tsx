"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@xyflow/react";
import { Loader2, RefreshCw } from "lucide-react";
import { GraphKindNode } from "@/components/plant/spike/GraphKindNode";
import {
  projectFoundationGraph,
  projectProcessStepGraph,
  type BusinessGraph,
  type GraphFlowNodeData,
} from "@/lib/business-graph";

const nodeTypes: NodeTypes = {
  graphNode: GraphKindNode,
};

type ViewMode = "foundation" | "steps";

type InnerProps = {
  graph: BusinessGraph | null;
  loading?: boolean;
  processId?: string | null;
  onRefresh?: () => void;
  onReseed?: () => void;
  onPositionCommit?: (id: string, x: number, y: number) => void;
};

function BusinessGraphCanvasInner({
  graph,
  loading,
  processId,
  onRefresh,
  onReseed,
  onPositionCommit,
}: InnerProps) {
  const { fitView } = useReactFlow();
  const [view, setView] = useState<ViewMode>("foundation");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    processId ?? null,
  );
  const [nodes, setNodes] = useState<Node<GraphFlowNodeData>[]>([]);
  const [edges, setEdges] = useState<
    ReturnType<typeof projectFoundationGraph>["edges"]
  >([]);

  const processes = useMemo(
    () => graph?.nodes.filter((n) => n.kind === "process") ?? [],
    [graph],
  );

  useEffect(() => {
    if (processId) {
      setSelectedProcessId(processId);
      setView("steps");
    }
  }, [processId]);

  useEffect(() => {
    if (!graph) {
      setNodes([]);
      setEdges([]);
      return;
    }
    if (view === "steps" && selectedProcessId) {
      const projected = projectProcessStepGraph(graph, selectedProcessId);
      setNodes(projected.nodes);
      setEdges(projected.edges);
    } else {
      const projected = projectFoundationGraph(graph);
      setNodes(projected.nodes);
      setEdges(projected.edges);
    }
  }, [graph, view, selectedProcessId]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200 });
    });
    return () => cancelAnimationFrame(t);
  }, [view, selectedProcessId, graph?.updatedAt, fitView, nodes.length]);

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading graph…
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-semibold text-text-strong">
            Empty business graph
          </h2>
          <p className="text-sm text-text-muted">
            Talk in Foundation to seed units, or reseed from existing functions
            and processes.
          </p>
          {onReseed ? (
            <button type="button" className="btn-primary text-sm" onClick={onReseed}>
              Seed from legacy data
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-bg">
        <div>
          <p className="text-xs font-semibold text-text-strong">
            Business graph
          </p>
          <p className="text-[11px] text-text-muted">
            {graph.nodes.length} nodes · {graph.edges.length} edges · local
            graphJson
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            <button
              type="button"
              className={`px-2 py-1.5 ${
                view === "foundation"
                  ? "bg-bg-muted text-text-strong"
                  : "bg-bg-panel text-text-muted"
              }`}
              onClick={() => setView("foundation")}
            >
              Foundation view
            </button>
            <button
              type="button"
              className={`px-2 py-1.5 border-l border-border ${
                view === "steps"
                  ? "bg-bg-muted text-text-strong"
                  : "bg-bg-panel text-text-muted"
              }`}
              onClick={() => setView("steps")}
              disabled={processes.length === 0}
            >
              Process steps
            </button>
          </div>
          {view === "steps" ? (
            <select
              className="text-xs bg-bg-panel border border-border rounded-lg px-2 py-1.5 text-text"
              value={selectedProcessId ?? ""}
              onChange={(e) => setSelectedProcessId(e.target.value || null)}
            >
              <option value="">Select process…</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border text-text-muted"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          ) : null}
          {onReseed ? (
            <button
              type="button"
              onClick={onReseed}
              className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-muted"
            >
              Reseed
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-bg"
        >
          <Background gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap
            className="!bg-bg-panel !border-border"
            maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function BusinessGraphCanvas(props: InnerProps) {
  return (
    <ReactFlowProvider>
      <BusinessGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
