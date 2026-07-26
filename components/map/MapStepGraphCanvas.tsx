"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
  FileCode2,
  GitBranch,
  Hammer,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { GraphKindNode } from "@/components/plant/spike/GraphKindNode";
import {
  exportProcessStepsToMermaid,
  projectProcessStepGraph,
  type BusinessGraph,
  type GraphFlowNodeData,
  type GraphNode,
} from "@/lib/business-graph";
import { MERMAID_LEGACY_HINT } from "@/lib/mermaid-policy";

const nodeTypes: NodeTypes = {
  graphNode: GraphKindNode,
};

export type ProcessMeta = {
  id: string;
  name: string;
  hasDiagram: boolean;
  department?: string | null;
};

export type MapStepGraphCanvasProps = {
  graph: BusinessGraph | null;
  loading?: boolean;
  processId: string | null;
  processMeta?: ProcessMeta | null;
  processes: ProcessMeta[];
  onSelectProcess: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onPositionCommit?: (id: string, x: number, y: number) => void;
  onAddStep?: () => void;
  onRenameStep?: (id: string, name: string) => Promise<void>;
  onDeleteStep?: (id: string, name: string) => Promise<void>;
  linkMode: boolean;
  onLinkModeChange: (on: boolean) => void;
  linkFromId: string | null;
  onLinkFromChange: (id: string | null) => void;
  onCreateFlow?: (fromId: string, toId: string) => Promise<void>;
  onDeleteEdge?: (edgeId: string) => Promise<void>;
  onOpenWorkshop?: (processId: string) => void;
};

function StepInspector({
  node,
  processMeta,
  onClear,
  onRename,
  onDelete,
  onOpenWorkshop,
}: {
  node: GraphNode;
  processMeta?: ProcessMeta | null;
  onClear: () => void;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string, name: string) => Promise<void>;
  onOpenWorkshop?: (processId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(node.name);
    setEditing(false);
  }, [node.id, node.name]);

  const isStep = node.kind === "step";
  const isProcess = node.kind === "process";

  return (
    <div className="shrink-0 border-t border-border bg-bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-text-muted">
            {isStep ? "Step" : isProcess ? "Process" : node.kind}
          </p>
          {editing && isStep ? (
            <form
              className="flex items-center gap-2 mt-1"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onRename || !name.trim()) return;
                setSaving(true);
                try {
                  await onRename(node.id, name.trim());
                  setEditing(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <input
                className="input text-sm py-1 flex-1 min-w-0"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={saving}
              />
              <button type="submit" className="btn-primary text-xs" disabled={saving}>
                Save
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  setName(node.name);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <h3
              className="text-sm font-semibold text-text-strong truncate mt-0.5"
              title={node.name}
            >
              {node.name}
            </h3>
          )}
          {isProcess ? (
            <p className="text-[11px] text-text-muted mt-1">
              Steps under this process are the Map depth SoT. Mermaid is legacy
              only.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-text-muted hover:text-text shrink-0"
        >
          Clear
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isStep && onRename ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
        ) : null}
        {isStep && onDelete ? (
          <button
            type="button"
            className="btn-secondary text-xs inline-flex items-center gap-1 text-red"
            onClick={() => void onDelete(node.id, node.name)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete step
          </button>
        ) : null}
        {isProcess && processMeta?.hasDiagram && onOpenWorkshop ? (
          <button
            type="button"
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
            onClick={() => onOpenWorkshop(node.id)}
            title="Open legacy Mermaid Workshop"
          >
            <Hammer className="w-3.5 h-3.5" />
            Workshop (Mermaid)
          </button>
        ) : null}
        {isProcess && processMeta && !processMeta.hasDiagram ? (
          <span className="text-[11px] text-text-faint self-center">
            No Mermaid diagram — step graph is primary
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MapStepGraphCanvasInner({
  graph,
  loading,
  processId,
  processMeta,
  processes,
  onSelectProcess,
  selectedNodeId,
  onSelectNode,
  onPositionCommit,
  onAddStep,
  onRenameStep,
  onDeleteStep,
  linkMode,
  onLinkModeChange,
  linkFromId,
  onLinkFromChange,
  onCreateFlow,
  onDeleteEdge,
  onOpenWorkshop,
}: MapStepGraphCanvasProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node<GraphFlowNodeData>[]>([]);
  const [edges, setEdges] = useState<
    ReturnType<typeof projectProcessStepGraph>["edges"]
  >([]);
  const [linking, setLinking] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [graph, selectedNodeId]);

  const stepCount = useMemo(() => {
    if (!graph || !processId) return 0;
    return graph.nodes.filter(
      (n) => n.kind === "step" && n.parentId === processId,
    ).length;
  }, [graph, processId]);

  useEffect(() => {
    if (!graph || !processId) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const projected = projectProcessStepGraph(graph, processId);
    setNodes(
      projected.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    );
    setEdges(
      projected.edges.map((e) => ({
        ...e,
        selected: e.id === selectedEdgeId,
      })),
    );
  }, [graph, processId, selectedNodeId, selectedEdgeId]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 220 });
    });
    return () => cancelAnimationFrame(t);
  }, [graph?.updatedAt, processId, fitView, nodes.length]);

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
    ({ nodes: sel, edges: selEdges }) => {
      if (selEdges[0]?.id) {
        setSelectedEdgeId(selEdges[0].id);
        onSelectNode(null);
        return;
      }
      setSelectedEdgeId(null);
      onSelectNode(sel[0]?.id ?? null);
    },
    [onSelectNode],
  );

  const handleNodeClick = useCallback(
    async (_e: ReactMouseEvent, node: Node) => {
      if (!linkMode) return;
      const kind = (node.data as GraphFlowNodeData)?.kind;
      if (kind !== "step") return;
      if (!linkFromId) {
        onLinkFromChange(node.id);
        onSelectNode(node.id);
        return;
      }
      if (linkFromId === node.id) {
        onLinkFromChange(null);
        return;
      }
      if (!onCreateFlow) return;
      setLinking(true);
      try {
        await onCreateFlow(linkFromId, node.id);
        onLinkFromChange(null);
      } finally {
        setLinking(false);
      }
    },
    [linkMode, linkFromId, onLinkFromChange, onSelectNode, onCreateFlow],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-text-muted min-h-[280px]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading step graph…
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-text-muted">No business graph loaded.</p>
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[280px]">
        <div className="max-w-md text-center space-y-3">
          <GitBranch className="w-10 h-10 mx-auto text-text-muted" />
          <h2 className="text-lg font-semibold text-text-strong">
            No processes on the graph yet
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Seed drafts in Foundation or reseed the graph from existing
            processes. Then open a process here to build its step graph — the
            depth source of truth.
          </p>
        </div>
      </div>
    );
  }

  if (!processId) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <ProcessPickerBar
          processes={processes}
          processId={processId}
          onSelectProcess={onSelectProcess}
          stepCount={0}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-text-muted">
            Select a process to edit its step graph.
          </p>
        </div>
      </div>
    );
  }

  const processExists = graph.nodes.some(
    (n) => n.id === processId && n.kind === "process",
  );

  if (!processExists) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <ProcessPickerBar
          processes={processes}
          processId={processId}
          onSelectProcess={onSelectProcess}
          stepCount={0}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-3">
            <p className="text-sm text-text-muted">
              This process is not on the graph yet. Reseed from Foundation data
              or pick another process.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const copyStepsMermaid = async () => {
    if (!graph || !processId) return;
    const mermaid = exportProcessStepsToMermaid(graph, processId);
    if (!mermaid) {
      toast.error("Could not export steps to Mermaid");
      return;
    }
    try {
      await navigator.clipboard.writeText(mermaid);
      toast.success("Step graph copied as Mermaid", {
        description: MERMAID_LEGACY_HINT,
      });
    } catch {
      toast.error("Clipboard unavailable", {
        description: "Select and copy from the browser console if needed.",
      });
      console.info("[export-mermaid]\n" + mermaid);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between gap-3 flex-wrap border-b border-border">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-strong">Step graph</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {stepCount} step{stepCount === 1 ? "" : "s"}
            {" · "}
            depth SoT (xyflow)
            {linkMode
              ? linkFromId
                ? " · click target step"
                : " · click source step"
              : " · drag to arrange"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <select
            className="text-xs bg-bg-panel border border-border rounded-lg px-2 py-1.5 text-text max-w-[200px]"
            value={processId}
            onChange={(e) => onSelectProcess(e.target.value || null)}
            aria-label="Process"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.hasDiagram ? " · Mermaid" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              onLinkModeChange(!linkMode);
              onLinkFromChange(null);
              setSelectedEdgeId(null);
            }}
            className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              linkMode
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-bg-panel text-text-muted hover:bg-bg-subtle"
            }`}
            disabled={stepCount < 2}
            title={
              stepCount < 2
                ? "Add at least two steps to link"
                : "Connect steps with flows_to"
            }
          >
            <Link2 className="w-3.5 h-3.5" />
            {linkMode ? "Linking…" : "Link steps"}
          </button>
          {selectedEdgeId && onDeleteEdge ? (
            <button
              type="button"
              onClick={() => {
                void onDeleteEdge(selectedEdgeId).then(() =>
                  setSelectedEdgeId(null),
                );
              }}
              className="btn-secondary text-xs inline-flex items-center gap-1.5 text-red"
            >
              <Unlink className="w-3.5 h-3.5" />
              Delete edge
            </button>
          ) : null}
          {onAddStep ? (
            <button
              type="button"
              onClick={onAddStep}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add step
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyStepsMermaid()}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
            title={`Copy step graph as Mermaid flowchart. ${MERMAID_LEGACY_HINT}`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Copy Mermaid
          </button>
          {processMeta?.hasDiagram && onOpenWorkshop ? (
            <button
              type="button"
              onClick={() => onOpenWorkshop(processId)}
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
              title="Open legacy Mermaid Workshop for this process"
            >
              <Hammer className="w-3.5 h-3.5" />
              Workshop
            </button>
          ) : null}
        </div>
      </div>

      {stepCount === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 min-h-[200px]">
          <div className="max-w-md text-center space-y-3">
            <h3 className="text-base font-semibold text-text-strong">
              No steps yet
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Build the executable path for{" "}
              <strong className="text-text font-medium">
                {processMeta?.name ?? "this process"}
              </strong>
              . Steps and edges here are the source of truth — not Mermaid.
            </p>
            {onAddStep ? (
              <button
                type="button"
                onClick={onAddStep}
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add first step
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={`flex-1 min-h-0 ${linking ? "opacity-80" : ""}`}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={onSelectionChange}
            onNodeClick={handleNodeClick}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            className="bg-bg"
            nodesDraggable={!linkMode}
            elementsSelectable
            edgesFocusable
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
      )}

      {selectedNode ? (
        <StepInspector
          node={selectedNode}
          processMeta={processMeta}
          onClear={() => onSelectNode(null)}
          onRename={onRenameStep}
          onDelete={onDeleteStep}
          onOpenWorkshop={onOpenWorkshop}
        />
      ) : null}
    </div>
  );
}

function ProcessPickerBar({
  processes,
  processId,
  onSelectProcess,
  stepCount,
}: {
  processes: ProcessMeta[];
  processId: string | null;
  onSelectProcess: (id: string | null) => void;
  stepCount: number;
}) {
  return (
    <div className="shrink-0 px-4 py-2 border-b border-border flex items-center gap-2">
      <select
        className="text-xs bg-bg-panel border border-border rounded-lg px-2 py-1.5 text-text"
        value={processId ?? ""}
        onChange={(e) => onSelectProcess(e.target.value || null)}
      >
        <option value="">Select process…</option>
        {processes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-text-muted">
        {stepCount} steps
      </span>
    </div>
  );
}

export function MapStepGraphCanvas(props: MapStepGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <MapStepGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
