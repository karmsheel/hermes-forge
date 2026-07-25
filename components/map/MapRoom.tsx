"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  GodModeCanvas,
  type GodModeStats,
} from "@/components/god-mode/GodModeCanvas";
import { SoftRoomLock } from "@/components/shell/SoftRoomLock";
import { useForgeStage } from "@/components/shell/StageProvider";
import { useShell } from "@/components/shell/ShellContext";
import { setActiveProcessId } from "@/lib/workshop-storage";
import type { BusinessGraph, GraphPatchOp } from "@/lib/business-graph";
import { PLANT_APPLIED_EVENT } from "@/lib/plant-apply";
import {
  MapStepGraphCanvas,
  type ProcessMeta,
} from "./MapStepGraphCanvas";

type MapMode = "steps" | "plant";

function newStepId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `step_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `step_${Date.now().toString(36)}`;
}

/**
 * Map room: step graph SoT (Phase 8.4) with dual-run legacy plant (God Mode).
 * Hosted on /god-mode for route compatibility.
 */
export function MapRoom() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const { isRoomUnlocked } = useForgeStage();
  const mapReady = isRoomUnlocked("map");

  const [mode, setMode] = useState<MapMode>("steps");
  const [graph, setGraph] = useState<BusinessGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [processMetaList, setProcessMetaList] = useState<ProcessMeta[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [plantStats, setPlantStats] = useState<GodModeStats>({
    total: 0,
    withDiagrams: 0,
    viewMode: "compact",
  });

  const loadGraph = useCallback(
    async (opts?: { reseed?: boolean; quiet?: boolean }) => {
      setGraphLoading(true);
      try {
        const q = opts?.reseed ? "?reseed=1" : "";
        const res = await fetch(`/api/business-graph${q}`);
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!opts?.quiet) {
            toast.error(data.error || "Failed to load business graph");
          }
          setGraph(null);
          return;
        }
        setGraph(data.graph as BusinessGraph | null);
        if (data.seeded && opts?.reseed) {
          toast.success("Graph reseeded from functions & processes");
        } else if (data.seeded && !opts?.quiet) {
          toast.message("Graph seeded from existing business data");
        }
      } catch {
        if (!opts?.quiet) toast.error("Failed to load business graph");
        setGraph(null);
      } finally {
        setGraphLoading(false);
      }
    },
    [router],
  );

  const loadProcessMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/processes");
      if (!res.ok) return;
      const data = await res.json();
      const rows = (Array.isArray(data.processes) ? data.processes : []) as Array<{
        id: string;
        name: string;
        department?: string | null;
        diagramMermaid?: string | null;
      }>;
      setProcessMetaList(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          department: p.department ?? null,
          hasDiagram: Boolean(p.diagramMermaid?.trim()),
        })),
      );
    } catch {
      /* optional for Mermaid bridge */
    }
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    void loadGraph({ quiet: true });
    void loadProcessMeta();
  }, [mapReady, loadGraph, loadProcessMeta, currentBusiness?.id]);

  // Studio forge-graph / plant fences → refresh Map graph (no full reseed unless empty seed)
  useEffect(() => {
    function onPlantApplied() {
      void loadGraph({ quiet: true });
      void loadProcessMeta();
    }
    window.addEventListener(PLANT_APPLIED_EVENT, onPlantApplied);
    return () =>
      window.removeEventListener(PLANT_APPLIED_EVENT, onPlantApplied);
  }, [loadGraph, loadProcessMeta]);

  const graphProcesses = useMemo((): ProcessMeta[] => {
    if (!graph) return [];
    const metaById = new Map(processMetaList.map((p) => [p.id, p]));
    return graph.nodes
      .filter((n) => n.kind === "process")
      .map((n) => {
        const meta = metaById.get(n.id);
        return {
          id: n.id,
          name: n.name,
          department: meta?.department ?? null,
          hasDiagram: meta?.hasDiagram ?? false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [graph, processMetaList]);

  // Prefer first process when graph loads / selection invalid
  useEffect(() => {
    if (graphProcesses.length === 0) {
      setSelectedProcessId(null);
      return;
    }
    setSelectedProcessId((prev) => {
      if (prev && graphProcesses.some((p) => p.id === prev)) return prev;
      return graphProcesses[0]!.id;
    });
  }, [graphProcesses]);

  const selectedMeta = useMemo(
    () => graphProcesses.find((p) => p.id === selectedProcessId) ?? null,
    [graphProcesses, selectedProcessId],
  );

  const stepCount = useMemo(() => {
    if (!graph || !selectedProcessId) return 0;
    return graph.nodes.filter(
      (n) => n.kind === "step" && n.parentId === selectedProcessId,
    ).length;
  }, [graph, selectedProcessId]);

  const applyOps = useCallback(
    async (ops: GraphPatchOp[]): Promise<BusinessGraph | null> => {
      const res = await fetch("/api/business-graph", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Graph update failed");
        return null;
      }
      if (data.errors?.length) {
        toast.error(String(data.errors[0]));
      }
      if (data.graph) {
        setGraph(data.graph as BusinessGraph);
        return data.graph as BusinessGraph;
      }
      return null;
    },
    [],
  );

  const onPositionCommit = useCallback(
    async (id: string, x: number, y: number) => {
      await applyOps([{ op: "set_position", id, position: { x, y } }]);
    },
    [applyOps],
  );

  const handleAddStep = useCallback(async () => {
    if (!selectedProcessId) return;
    const id = newStepId();
    const n =
      (graph?.nodes.filter(
        (x) => x.kind === "step" && x.parentId === selectedProcessId,
      ).length ?? 0) + 1;
    const name = `Step ${n}`;
    const col = (n - 1) % 4;
    const row = Math.floor((n - 1) / 4);
    const result = await applyOps([
      {
        op: "upsert_node",
        node: {
          id,
          kind: "step",
          name,
          parentId: selectedProcessId,
          position: { x: 280 + col * 180, y: 120 + row * 100 },
        },
      },
      {
        op: "upsert_edge",
        edge: {
          id: `contains_${selectedProcessId}_${id}`,
          kind: "contains",
          fromId: selectedProcessId,
          toId: id,
        },
      },
    ]);
    if (result) {
      setSelectedNodeId(id);
      toast.success(`Added “${name}”`);
    }
  }, [selectedProcessId, graph, applyOps]);

  const handleRenameStep = useCallback(
    async (id: string, name: string) => {
      const existing = graph?.nodes.find((n) => n.id === id);
      if (!existing) return;
      await applyOps([
        {
          op: "upsert_node",
          node: { ...existing, name },
        },
      ]);
      toast.success("Renamed");
    },
    [graph, applyOps],
  );

  const handleDeleteStep = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete step “${name}”?`)) return;
      await applyOps([{ op: "delete_node", id }]);
      if (selectedNodeId === id) setSelectedNodeId(null);
      if (linkFromId === id) setLinkFromId(null);
      toast.success("Step deleted");
    },
    [applyOps, selectedNodeId, linkFromId],
  );

  const handleCreateFlow = useCallback(
    async (fromId: string, toId: string) => {
      const edgeId = `flow_${fromId}_${toId}`;
      await applyOps([
        {
          op: "upsert_edge",
          edge: {
            id: edgeId,
            kind: "flows_to",
            fromId,
            toId,
          },
        },
      ]);
      toast.success("Linked steps");
    },
    [applyOps],
  );

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!window.confirm("Remove this flow edge?")) return;
      await applyOps([{ op: "delete_edge", id: edgeId }]);
      toast.success("Edge removed");
    },
    [applyOps],
  );

  const openWorkshop = useCallback(
    (processId: string) => {
      if (currentBusiness?.id) {
        setActiveProcessId(currentBusiness.id, processId);
      }
      router.push("/workshop");
    },
    [currentBusiness?.id, router],
  );

  if (!mapReady) {
    return (
      <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
        <div className="p-6">
          <SoftRoomLock
            room="map"
            title="Map fills as processes appear"
            description="Talk with Overlord in Foundation to seed draft process shapes. The plant map soft-unlocks when the first process exists."
          />
        </div>
      </div>
    );
  }

  const processCount = graphProcesses.length;

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 sm:px-6 py-2 flex items-center justify-between gap-3 bg-bg">
        <p className="text-xs text-text-muted truncate min-w-0">
          {mode === "steps" ? (
            <>
              {processCount} process{processCount !== 1 ? "es" : ""}
              {selectedMeta ? (
                <>
                  {" · "}
                  {selectedMeta.name}
                  {" · "}
                  {stepCount} step{stepCount !== 1 ? "s" : ""}
                </>
              ) : null}
              {" · "}
              step graph SoT
            </>
          ) : (
            <>
              {plantStats.total} process{plantStats.total !== 1 ? "es" : ""}
              {plantStats.viewMode === "compact" ? (
                <> · plant shapes</>
              ) : plantStats.withDiagrams > 0 ? (
                <>
                  {" "}
                  · {plantStats.withDiagrams} with diagram
                  {plantStats.withDiagrams !== 1 ? "s" : ""}
                </>
              ) : null}
            </>
          )}
        </p>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div
            className="flex rounded-lg border border-border overflow-hidden text-xs"
            role="group"
            aria-label="Map canvas mode"
          >
            <button
              type="button"
              onClick={() => setMode("steps")}
              className={`px-2.5 py-1.5 inline-flex items-center gap-1 ${
                mode === "steps"
                  ? "bg-bg-muted text-text-strong"
                  : "bg-bg-panel text-text-muted hover:bg-bg-subtle"
              }`}
              title="Process step graph (Phase 8 SoT)"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Steps
            </button>
            <button
              type="button"
              onClick={() => setMode("plant")}
              className={`px-2.5 py-1.5 border-l border-border inline-flex items-center gap-1 ${
                mode === "plant"
                  ? "bg-bg-muted text-text-strong"
                  : "bg-bg-panel text-text-muted hover:bg-bg-subtle"
              }`}
              title="Legacy process plant overview"
            >
              <Network className="w-3.5 h-3.5" />
              Plant
            </button>
          </div>
          {mode === "steps" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void loadGraph({ quiet: true });
                  void loadProcessMeta();
                }}
                className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${graphLoading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => void loadGraph({ reseed: true })}
                className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-muted hover:bg-bg-subtle"
              >
                Reseed
              </button>
            </>
          ) : null}
        </div>
      </header>

      {mode === "steps" ? (
        graphLoading && !graph ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading map graph…
          </div>
        ) : (
          <MapStepGraphCanvas
            graph={graph}
            loading={false}
            processId={selectedProcessId}
            processMeta={selectedMeta}
            processes={graphProcesses}
            onSelectProcess={(id) => {
              setSelectedProcessId(id);
              setSelectedNodeId(null);
              setLinkMode(false);
              setLinkFromId(null);
            }}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onPositionCommit={onPositionCommit}
            onAddStep={() => void handleAddStep()}
            onRenameStep={handleRenameStep}
            onDeleteStep={handleDeleteStep}
            linkMode={linkMode}
            onLinkModeChange={setLinkMode}
            linkFromId={linkFromId}
            onLinkFromChange={setLinkFromId}
            onCreateFlow={handleCreateFlow}
            onDeleteEdge={handleDeleteEdge}
            onOpenWorkshop={openWorkshop}
          />
        )
      ) : (
        <GodModeCanvas onStatsChange={setPlantStats} />
      )}
    </div>
  );
}
