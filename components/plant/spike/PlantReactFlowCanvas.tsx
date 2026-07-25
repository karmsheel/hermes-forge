"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hammer, Loader2, RefreshCw } from "lucide-react";
import { ForgeProcessNode } from "@/components/plant/spike/ForgeProcessNode";
import {
  projectPlantToFlow,
  type ForgeProcessNodeData,
  type PlantFlowProcess,
} from "@/lib/plant-flow-project";
import {
  PLANT_LAYOUT_MODE_LABELS,
  PLANT_LAYOUT_MODES,
  type PlantLayoutMode,
  type PlantManualPositions,
} from "@/lib/plant-layout";
import {
  loadPlantLayoutMode,
  loadPlantPositions,
  savePlantLayoutMode,
  upsertPlantPosition,
} from "@/lib/plant-layout-prefs";
import type { ProcessLinkDto } from "@/lib/process-links";
import { setActiveProcessId } from "@/lib/workshop-storage";

const nodeTypes: NodeTypes = {
  forgeProcess: ForgeProcessNode,
};

type PlantReactFlowCanvasInnerProps = {
  businessId: string | null;
  processes: PlantFlowProcess[];
  links: ProcessLinkDto[];
  loading?: boolean;
  onRefresh?: () => void;
  onCreateLink?: (fromId: string, toId: string) => Promise<void>;
};

function PlantReactFlowCanvasInner({
  businessId,
  processes,
  links,
  loading = false,
  onRefresh,
  onCreateLink,
}: PlantReactFlowCanvasInnerProps) {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const [layoutMode, setLayoutMode] = useState<PlantLayoutMode>("function");
  const [manualPositions, setManualPositions] = useState<PlantManualPositions>(
    {},
  );
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null,
  );
  const [nodes, setNodes] = useState<Node<ForgeProcessNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    setLayoutMode(loadPlantLayoutMode(businessId));
    setManualPositions(loadPlantPositions(businessId));
  }, [businessId]);

  useEffect(() => {
    const projected = projectPlantToFlow(processes, links, {
      layoutMode,
      positions: manualPositions,
      selectedProcessId,
    });
    setNodes(projected.nodes);
    setEdges(projected.edges);
  }, [processes, links, layoutMode, manualPositions, selectedProcessId]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200 });
    });
    return () => cancelAnimationFrame(t);
  }, [processes.length, layoutMode, fitView, nodes.length]);

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<ForgeProcessNodeData>[]);
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!businessId) return;
      const next = upsertPlantPosition(
        businessId,
        node.id,
        node.position.x,
        node.position.y,
      );
      setManualPositions(next);
      if (layoutMode !== "manual") {
        setLayoutMode("manual");
        savePlantLayoutMode(businessId, "manual");
      }
    },
    [businessId, layoutMode],
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !onCreateLink) return;
      if (connection.source === connection.target) return;
      setLinking(true);
      try {
        await onCreateLink(connection.source, connection.target);
      } catch {
        toast.error("Failed to create link");
      } finally {
        setLinking(false);
      }
    },
    [onCreateLink],
  );

  const openWorkshop = useCallback(
    (processId: string) => {
      if (businessId) {
        setActiveProcessId(businessId, processId);
      }
      router.push(`/workshop?processId=${encodeURIComponent(processId)}`);
    },
    [router, businessId],
  );

  const selected = useMemo(
    () => processes.find((p) => p.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  );

  function setPlantLayoutMode(mode: PlantLayoutMode) {
    setLayoutMode(mode);
    savePlantLayoutMode(businessId, mode);
    if (mode === "manual") {
      setManualPositions(loadPlantPositions(businessId));
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading plant…
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-2">
          <h2 className="text-lg font-semibold text-text-strong">
            xyflow plant spike
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            No processes yet. Seed drafts in Foundation, then refresh this
            canvas. Domain stays SoT — this view only projects them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap bg-bg">
        <div>
          <p className="text-xs font-semibold text-text-strong">
            Plant spike (xyflow L1)
          </p>
          <p className="text-[11px] text-text-muted">
            {processes.length} process{processes.length === 1 ? "" : "es"}
            {links.length > 0
              ? ` · ${links.length} link${links.length === 1 ? "" : "s"}`
              : ""}
            {linking ? " · linking…" : ""}
            {" · drag to place · connect handles · dbl-click → Workshop"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex rounded-lg border border-border overflow-hidden text-xs"
            role="group"
            aria-label="Plant layout"
          >
            {PLANT_LAYOUT_MODES.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => setPlantLayoutMode(m)}
                title={PLANT_LAYOUT_MODE_LABELS[m]}
                className={`px-2 py-1.5 ${i > 0 ? "border-l border-border" : ""} ${
                  layoutMode === m
                    ? "bg-bg-muted text-text-strong"
                    : "bg-bg-panel text-text-muted hover:bg-bg-subtle"
                }`}
              >
                {PLANT_LAYOUT_MODE_LABELS[m]}
              </button>
            ))}
          </div>
          {selected ? (
            <button
              type="button"
              onClick={() => openWorkshop(selected.id)}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Hammer className="w-3.5 h-3.5" />
              Workshop
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-bg-panel text-text-muted hover:bg-bg-subtle"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 plant-react-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedProcessId(node.id)}
          onNodeDoubleClick={(_, node) => openWorkshop(node.id)}
          onPaneClick={() => setSelectedProcessId(null)}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          className="bg-bg"
        >
          <Background gap={20} size={1} color="var(--border)" />
          <Controls
            showInteractive={false}
            className="!bg-bg-panel !border-border !shadow-none [&>button]:!bg-bg-panel [&>button]:!border-border [&>button]:!fill-text-muted"
          />
          <MiniMap
            className="!bg-bg-panel !border-border"
            maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
            nodeColor="var(--bg-elevated)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export type PlantReactFlowCanvasProps = PlantReactFlowCanvasInnerProps;

export function PlantReactFlowCanvas(props: PlantReactFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <PlantReactFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
