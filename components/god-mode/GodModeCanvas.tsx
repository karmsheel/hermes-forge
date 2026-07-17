"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  GitBranch,
  Hammer,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  RefreshCw,
  Unlink,
  Waypoints,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useShell } from "@/components/shell/ShellContext";
import { PlantPageContext } from "@/components/chatbar/page-providers/PlantPageContext";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";
import { PlantEdges } from "@/components/plant/PlantEdges";
import { PlantBoundaryLayer } from "@/components/plant/PlantBoundaryLayer";
import { PlantExportMenu } from "@/components/plant/PlantExportMenu";
import { getIoShapeMeta, normalizeIoShape } from "@/lib/io-shape";
import type { PlantExportInput } from "@/lib/export-plant";
import {
  loadGodModeViewMode,
  saveGodModeViewMode,
  type GodModeViewMode,
} from "@/lib/god-mode-view";
import {
  layoutPlantBoundaryFraming,
  type PlantBoundaryLayout,
} from "@/lib/plant-boundary";
import {
  getDeptLabelY as plantDeptLabelY,
  layoutPlant,
  PLANT_LAYOUT_MODE_LABELS,
  PLANT_LAYOUT_MODES,
  type PlantLayoutMode,
  type PlantManualPositions,
  type PlantTilePosition,
} from "@/lib/plant-layout";
import {
  loadPlantLayoutMode,
  loadPlantPositions,
  loadPlantShowBoundary,
  savePlantLayoutMode,
  savePlantShowBoundary,
  upsertPlantPosition,
} from "@/lib/plant-layout-prefs";
import type { ProcessLinkDto } from "@/lib/process-links";
import { renderMermaidSvg } from "@/lib/mermaid-render";
import { sanitizeMermaidSource } from "@/lib/mermaid-sanitize";
import { PROCESS_STATUS_LABELS } from "@/lib/process-status";
import { setActiveProcessId } from "@/lib/workshop-storage";
import type { ProcessSummary } from "@/lib/types";

const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const CANVAS_PADDING = 64;
const TILE_GAP = 48;
const DEPT_GAP = 56;
const TILE_HEADER_HEIGHT = 52;
const TILE_INNER_PADDING = 20;
const DEPT_HEADER_HEIGHT = 36;
const MAX_DIAGRAM_WIDTH = 420;
const MIN_TILE_WIDTH = 320;

interface DiagramTile {
  process: ProcessSummary;
  department: string;
  mode: "compact" | "diagram";
  svg: string | null;
  error: string | null;
  diagramWidth: number;
  diagramHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  tiles: DiagramTile[];
  canvasWidth: number;
  canvasHeight: number;
  departments: string[];
  byId?: Map<string, PlantTilePosition>;
  layoutMode?: PlantLayoutMode;
}

function groupByDepartment(processes: ProcessSummary[]): Map<string, ProcessSummary[]> {
  const groups = new Map<string, ProcessSummary[]>();
  for (const proc of processes) {
    const dept = (proc.department || "Uncategorized").trim();
    const list = groups.get(dept) ?? [];
    list.push(proc);
    groups.set(dept, list);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function layoutCompactTiles(
  processes: ProcessSummary[],
  opts: {
    layoutMode: PlantLayoutMode;
    links: ProcessLinkDto[];
    positions: PlantManualPositions;
  },
): LayoutResult {
  const plant = layoutPlant(
    processes.map((p) => ({ id: p.id, department: p.department })),
    {
      mode: opts.layoutMode,
      edges: opts.links.map((l) => ({
        fromId: l.fromProcessId,
        toId: l.toProcessId,
      })),
      positions: opts.positions,
    },
  );
  const byProc = new Map(processes.map((p) => [p.id, p]));
  const tiles: DiagramTile[] = plant.tiles.map((pos) => ({
    process: byProc.get(pos.id)!,
    department: pos.department,
    mode: "compact" as const,
    svg: null,
    error: null,
    diagramWidth: 0,
    diagramHeight: 0,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
  }));
  return {
    tiles,
    canvasWidth: plant.canvasWidth,
    canvasHeight: plant.canvasHeight,
    departments: plant.departments,
    byId: plant.byId,
    layoutMode: plant.mode,
  };
}

function layoutDiagramTiles(
  rendered: Array<{
    process: ProcessSummary;
    department: string;
    svg: string | null;
    error: string | null;
    diagramWidth: number;
    diagramHeight: number;
  }>,
): LayoutResult {
  const grouped = new Map<string, typeof rendered>();
  for (const item of rendered) {
    const list = grouped.get(item.department) ?? [];
    list.push(item);
    grouped.set(item.department, list);
  }

  const departments = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  const tiles: DiagramTile[] = [];
  let y = CANVAS_PADDING;
  let canvasMaxX = 0;

  for (const dept of departments) {
    const items = grouped.get(dept) ?? [];
    let rowX = CANVAS_PADDING;
    let rowMaxHeight = 0;
    let rowStartY = y + DEPT_HEADER_HEIGHT;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const scale =
        item.diagramWidth > 0
          ? Math.min(1, MAX_DIAGRAM_WIDTH / item.diagramWidth)
          : 1;
      const scaledW = Math.max(MIN_TILE_WIDTH, item.diagramWidth * scale);
      const scaledH = item.diagramHeight * scale;
      const tileWidth = scaledW + TILE_INNER_PADDING * 2;
      const tileHeight = TILE_HEADER_HEIGHT + scaledH + TILE_INNER_PADDING * 2;

      if (i > 0 && rowX + tileWidth > 2200) {
        y = rowStartY + rowMaxHeight + TILE_GAP;
        rowX = CANVAS_PADDING;
        rowStartY = y;
        rowMaxHeight = 0;
      }

      tiles.push({
        ...item,
        mode: "diagram",
        x: rowX,
        y: rowStartY,
        width: tileWidth,
        height: tileHeight,
      });

      rowX += tileWidth + TILE_GAP;
      rowMaxHeight = Math.max(rowMaxHeight, tileHeight);
      canvasMaxX = Math.max(canvasMaxX, rowX);
    }

    y = rowStartY + rowMaxHeight + DEPT_GAP;
  }

  return {
    tiles,
    canvasWidth: Math.max(canvasMaxX + CANVAS_PADDING, 800),
    canvasHeight: Math.max(y + CANVAS_PADDING, 600),
    departments,
  };
}

function getDeptLabelY(dept: string, tiles: DiagramTile[]): number {
  return plantDeptLabelY(
    dept,
    tiles.map((t) => ({
      id: t.process.id,
      department: t.department,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
    }))
  );
}

export interface GodModeStats {
  total: number;
  withDiagrams: number;
  viewMode: GodModeViewMode;
}

interface GodModeCanvasProps {
  onStatsChange?: (stats: GodModeStats) => void;
}

export function GodModeCanvas({ onStatsChange }: GodModeCanvasProps) {
  const router = useRouter();
  const { resolved } = useTheme();
  const { currentBusiness } = useShell();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [links, setLinks] = useState<ProcessLinkDto[]>([]);
  const [viewMode, setViewMode] = useState<GodModeViewMode>("compact");
  const [layoutMode, setLayoutMode] = useState<PlantLayoutMode>("function");
  const [manualPositions, setManualPositions] = useState<PlantManualPositions>({});
  const [showBoundary, setShowBoundary] = useState(true);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  /** Compact plant block selection (not workshop navigation). */
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const selectedProcess = useMemo(
    () => processes.find((p) => p.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  );
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const hasFitRef = useRef(false);
  const processesRef = useRef<ProcessSummary[]>([]);
  const linksRef = useRef<ProcessLinkDto[]>([]);
  const dragMovedRef = useRef(false);

  const isDark = resolved === "dark";

  useEffect(() => {
    setViewMode(loadGodModeViewMode());
  }, []);

  const fitToCanvas = useCallback((canvasW: number, canvasH: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const padding = 48;
    const availW = viewport.clientWidth - padding * 2;
    const availH = viewport.clientHeight - padding * 2;
    if (availW <= 0 || availH <= 0) return;

    const fitZoom = Math.min(availW / canvasW, availH / canvasH, 1);
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
    const panX = (viewport.clientWidth - canvasW * clampedZoom) / 2;
    const panY = (viewport.clientHeight - canvasH * clampedZoom) / 2;

    setZoom(clampedZoom);
    setPan({ x: panX, y: panY });
  }, []);

  const applyLayout = useCallback(
    async (
      list: ProcessSummary[],
      mode: GodModeViewMode,
      plantMode: PlantLayoutMode,
      plantLinks: ProcessLinkDto[],
      positions: PlantManualPositions,
    ) => {
      hasFitRef.current = false;
      const withDiagrams = list.filter((p) => p.diagramMermaid?.trim());

      onStatsChange?.({
        total: list.length,
        withDiagrams: withDiagrams.length,
        viewMode: mode,
      });

      if (mode === "compact") {
        if (list.length === 0) {
          setLayout(null);
          return;
        }
        setLayout(
          layoutCompactTiles(list, {
            layoutMode: plantMode,
            links: plantLinks,
            positions,
          }),
        );
        return;
      }

      // diagrams mode
      if (withDiagrams.length === 0) {
        setLayout(null);
        return;
      }

      setRendering(true);
      try {
        const grouped = groupByDepartment(withDiagrams);
        const jobs = [...grouped.entries()].flatMap(([dept, procs]) =>
          procs.map((proc) => ({ proc, dept })),
        );

        const renderJobs = await Promise.all(
          jobs.map(async ({ proc, dept }) => {
            const source = sanitizeMermaidSource(proc.diagramMermaid);
            if (!source) {
              return {
                process: proc,
                department: dept,
                svg: null,
                error: "No diagram source",
                diagramWidth: 0,
                diagramHeight: 0,
              };
            }

            const result = await renderMermaidSvg(
              source,
              `godmode-${proc.id}-${Date.now()}`,
              isDark,
            );

            return {
              process: proc,
              department: dept,
              svg: result.ok ? result.svg : null,
              error: result.ok ? null : result.error,
              diagramWidth: result.ok ? result.width : 0,
              diagramHeight: result.ok ? result.height : 0,
            };
          }),
        );

        setLayout(layoutDiagramTiles(renderJobs));
      } finally {
        setRendering(false);
      }
    },
    [isDark, onStatsChange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [procRes, linkRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/process-links"),
      ]);
      if (procRes.status === 401) {
        router.push("/");
        return;
      }
      const data = await procRes.json();
      const list: ProcessSummary[] = data.processes || [];
      const biz = data.business;
      const mode = loadGodModeViewMode();
      setViewMode(mode);

      let nextLinks: ProcessLinkDto[] = [];
      if (linkRes.ok) {
        try {
          const linkData = await linkRes.json();
          nextLinks = linkData.links || [];
        } catch {
          nextLinks = [];
        }
      }
      setLinks(nextLinks);
      linksRef.current = nextLinks;

      if (!biz) {
        setBusinessId(null);
        setProcesses([]);
        processesRef.current = [];
        setLayout(null);
        onStatsChange?.({ total: 0, withDiagrams: 0, viewMode: mode });
        return;
      }

      setBusinessId(biz.id);
      setLayoutMode(loadPlantLayoutMode(biz.id));
      setManualPositions(loadPlantPositions(biz.id));
      setShowBoundary(loadPlantShowBoundary(biz.id));
      setProcesses(list);
      processesRef.current = list;
    } catch {
      toast.error("Failed to load God Mode view");
      setProcesses([]);
      processesRef.current = [];
      setLayout(null);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [onStatsChange, router]);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  // Layout whenever data, view mode, plant layout, or theme changes (no network)
  useEffect(() => {
    if (loading) return;
    if (!businessId) {
      setLayout(null);
      return;
    }
    void applyLayout(
      processesRef.current,
      viewMode,
      layoutMode,
      linksRef.current,
      manualPositions,
    );
  }, [
    loading,
    businessId,
    viewMode,
    layoutMode,
    manualPositions,
    isDark,
    processes,
    links,
    applyLayout,
  ]);

  const deptPositions = useMemo(() => {
    if (!layout) return [];
    return layout.departments.map((dept) => ({
      dept,
      y: getDeptLabelY(dept, layout.tiles),
    }));
  }, [layout]);

  const boundaryLayout: PlantBoundaryLayout | null = useMemo(() => {
    if (!layout || viewMode !== "compact" || layout.tiles.length === 0) {
      return null;
    }
    return layoutPlantBoundaryFraming({
      tiles: layout.tiles.map((t) => ({
        id: t.process.id,
        department: t.department,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
      })),
      baseCanvasWidth: layout.canvasWidth,
      baseCanvasHeight: layout.canvasHeight,
      processes: processes.map((p) => ({
        id: p.id,
        name: p.name,
        inputs: p.inputs,
        outputs: p.outputs,
      })),
      links: links.map((l) => ({
        fromId: l.fromProcessId,
        toId: l.toProcessId,
      })),
    });
  }, [layout, viewMode, processes, links]);

  const framingActive =
    showBoundary &&
    viewMode === "compact" &&
    Boolean(boundaryLayout?.hasItems);

  const plantCanvasWidth =
    framingActive && boundaryLayout
      ? boundaryLayout.canvasWidth
      : layout?.canvasWidth ?? 800;
  const plantCanvasHeight =
    framingActive && boundaryLayout
      ? boundaryLayout.canvasHeight
      : layout?.canvasHeight ?? 600;
  const tileOffset =
    framingActive && boundaryLayout
      ? boundaryLayout.tileOffset
      : { x: 0, y: 0 };

  useEffect(() => {
    if (!layout || hasFitRef.current) return;
    hasFitRef.current = true;
    fitToCanvas(plantCanvasWidth, plantCanvasHeight);
  }, [layout, fitToCanvas, plantCanvasWidth, plantCanvasHeight]);

  function setMode(next: GodModeViewMode) {
    setViewMode(next);
    saveGodModeViewMode(next);
  }

  function setPlantShowBoundary(on: boolean) {
    setShowBoundary(on);
    savePlantShowBoundary(businessId, on);
  }

  function setPlantLayoutMode(next: PlantLayoutMode) {
    setLayoutMode(next);
    if (businessId) savePlantLayoutMode(businessId, next);
    if (next === "manual" && businessId) {
      setManualPositions(loadPlantPositions(businessId));
    }
  }

  function handleTileDragEnd(processId: string, x: number, y: number) {
    if (!businessId) return;
    // Tile coords are in unframed plant space (offset applied via CSS wrapper).
    const next = upsertPlantPosition(businessId, processId, x, y);
    setManualPositions(next);
    if (layoutMode !== "manual") {
      setPlantLayoutMode("manual");
    }
  }

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(3)));
  }

  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(3)));
  }

  function handleFit() {
    if (layout) {
      fitToCanvas(plantCanvasWidth, plantCanvasHeight);
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    const scale = newZoom / zoom;

    setPan({
      x: mouseX - (mouseX - pan.x) * scale,
      y: mouseY - (mouseY - pan.y) * scale,
    });
    setZoom(newZoom);
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Tiles and plant edges handle their own gestures
    if (target.closest("[data-godmode-tile]")) return;
    if (target.closest("[data-plant-edge]")) return;

    // Empty canvas: deselect process/link, then pan
    setSelectedProcessId(null);
    setSelectedLinkId(null);
    setLinkFromId(null);

    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  }

  function handlePointerUp(e: ReactPointerEvent) {
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function openInWorkshop(processId: string) {
    if (!businessId) {
      router.push("/workshop");
      return;
    }
    setActiveProcessId(businessId, processId);
    router.push("/workshop");
  }

  async function createLink(fromId: string, toId: string) {
    const res = await fetch("/api/process-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromProcessId: fromId, toProcessId: toId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Could not create link");
      return;
    }
    toast.success("Linked processes");
    setLinkFromId(null);
    await load();
  }

  async function deleteSelectedLink() {
    if (!selectedLinkId) return;
    if (!window.confirm("Remove this plant link?")) return;
    const res = await fetch(`/api/process-links/${selectedLinkId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not delete link");
      return;
    }
    toast.success("Link removed");
    setSelectedLinkId(null);
    await load();
  }

  /** Select block (or complete link) — never navigates to Workshop. */
  function handleCompactTileSelect(processId: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setSelectedLinkId(null);
    if (linkMode && viewMode === "compact") {
      if (!linkFromId) {
        setLinkFromId(processId);
        setSelectedProcessId(processId);
        return;
      }
      if (linkFromId === processId) {
        setLinkFromId(null);
        setSelectedProcessId(processId);
        return;
      }
      void createLink(linkFromId, processId);
      setSelectedProcessId(processId);
      return;
    }
    setSelectedProcessId(processId);
  }

  /** Compact plant only — diagram tiles are Mermaid HTML, not vectorized for plant export. */
  const plantExportInput: PlantExportInput | null = useMemo(() => {
    if (viewMode !== "compact" || !layout || layout.tiles.length === 0) return null;
    const ox = framingActive ? tileOffset.x : 0;
    const oy = framingActive ? tileOffset.y : 0;
    return {
      businessName: currentBusiness?.name ?? "Business",
      blocks: layout.tiles.map((t) => ({
        id: t.process.id,
        name: t.process.name,
        department: t.department,
        status: t.process.status,
        ioShape: t.process.ioShape,
        x: t.x + ox,
        y: t.y + oy,
        width: t.width,
        height: t.height,
      })),
      links: links.map((l) => ({
        fromId: l.fromProcessId,
        toId: l.toProcessId,
      })),
      canvasWidth: plantCanvasWidth,
      canvasHeight: plantCanvasHeight,
      layoutMode,
      boundaryFeeds:
        framingActive && boundaryLayout
          ? boundaryLayout.feeds.map((c) => ({
              label: c.label,
              x: c.x,
              y: c.y,
              width: c.width,
              height: c.height,
              attachX: c.attachX,
              attachY: c.attachY,
            }))
          : undefined,
      boundaryProducts:
        framingActive && boundaryLayout
          ? boundaryLayout.products.map((c) => ({
              label: c.label,
              x: c.x,
              y: c.y,
              width: c.width,
              height: c.height,
              attachX: c.attachX,
              attachY: c.attachY,
            }))
          : undefined,
    };
  }, [
    viewMode,
    layout,
    links,
    layoutMode,
    currentBusiness?.name,
    framingActive,
    tileOffset.x,
    tileOffset.y,
    plantCanvasWidth,
    plantCanvasHeight,
    boundaryLayout,
  ]);

  if (loading) {
    return (
      <>
        <PlantPageContext process={null} links={[]} processCount={0} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      </>
    );
  }

  if (!businessId) {
    return (
      <>
        <PlantPageContext process={null} links={[]} processCount={0} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center card max-w-lg p-10">
            <Building2 className="w-10 h-10 text-text-soft mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No active business</h2>
            <p className="text-sm text-text-muted mb-6">
              Select or create a business to view the plant canvas.
            </p>
            <Link href="/foundation" className="btn-primary text-sm inline-flex items-center gap-2">
              Go to Foundation <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!layout || layout.tiles.length === 0) {
    const isDiagrams = viewMode === "diagrams";
    return (
      <>
        <PlantPageContext
          process={selectedProcess}
          links={links}
          processCount={processes.length}
        />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center card max-w-xl p-10">
            {isDiagrams ? (
              <GitBranch className="w-10 h-10 text-text-soft mx-auto mb-4" />
            ) : (
              <Layers className="w-10 h-10 text-text-soft mx-auto mb-4" />
            )}
            <h2 className="text-lg font-semibold mb-2">
              {isDiagrams ? "No diagrams yet" : "No processes yet"}
            </h2>
            <p className="text-sm text-text-muted mb-2">
              {processes.length === 0
                ? "This business has no processes yet."
                : isDiagrams
                  ? `${processes.length} process${processes.length !== 1 ? "es" : ""} exist, but none have diagrams.`
                  : "Add draft processes in Foundation to sketch the plant."}
            </p>
            <p className="text-xs text-text-soft mb-6">
              {isDiagrams
                ? "Map processes in the Workshop — their diagrams will appear here."
                : "Or open Foundation and seed drafts from chat."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isDiagrams && processes.length > 0 ? (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => setMode("compact")}
                >
                  Show compact shapes
                </button>
              ) : null}
              <Link
                href={processes.length === 0 ? "/foundation" : "/workshop"}
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                {processes.length === 0 ? (
                  <>
                    <Layers className="w-4 h-4" /> Open Foundation
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" /> Open Workshop
                  </>
                )}
              </Link>
            </div>
          </div>
        </div>
        <GodModeToolbar
          viewMode={viewMode}
          onViewModeChange={setMode}
          layoutMode={layoutMode}
          onLayoutModeChange={setPlantLayoutMode}
          tileCount={0}
          totalCount={processes.length}
          isDiagrams={isDiagrams}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFit={handleFit}
          onRefresh={() => void load()}
          disableZoom
        />
      </div>
      </>
    );
  }

  const displayPercent = Math.round(zoom * 100);
  const isDiagrams = viewMode === "diagrams";
  const missingCount = isDiagrams
    ? processes.length - layout.tiles.length
    : 0;
  const showDeptLabels =
    viewMode === "compact" && layoutMode === "function" && deptPositions.length > 0;

  return (
    <>
      <PlantPageContext
        process={selectedProcess}
        links={links}
        processCount={processes.length}
      />
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        ref={viewportRef}
        className={`flex-1 min-h-0 overflow-hidden relative bg-[radial-gradient(circle_at_1px_1px,#27272a_1px,transparent_0)] [background-size:24px_24px] ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/50 z-20">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        )}

        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: plantCanvasWidth,
            height: plantCanvasHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {framingActive && boundaryLayout ? (
            <PlantBoundaryLayer
              feeds={boundaryLayout.feeds}
              products={boundaryLayout.products}
              canvasWidth={plantCanvasWidth}
              canvasHeight={plantCanvasHeight}
            />
          ) : null}

          <div
            className="absolute top-0 left-0"
            style={{
              width: layout.canvasWidth,
              height: layout.canvasHeight,
              transform:
                tileOffset.x || tileOffset.y
                  ? `translate(${tileOffset.x}px, ${tileOffset.y}px)`
                  : undefined,
            }}
          >
            {showDeptLabels
              ? deptPositions.map(({ dept, y }) => (
                  <div
                    key={dept}
                    className="absolute left-0 text-xs uppercase tracking-widest text-text-muted font-medium"
                    style={{
                      top: y,
                      left: CANVAS_PADDING,
                      width: layout.canvasWidth - CANVAS_PADDING * 2,
                    }}
                  >
                    {dept}
                  </div>
                ))
              : null}

            {viewMode === "compact" && layout.byId ? (
              <PlantEdges
                links={links}
                byId={layout.byId}
                canvasWidth={layout.canvasWidth}
                canvasHeight={layout.canvasHeight}
                selectedLinkId={selectedLinkId}
                onSelectLink={(id) => {
                  setSelectedLinkId(id);
                  setLinkFromId(null);
                  setSelectedProcessId(null);
                }}
              />
            ) : null}

            {layout.tiles.map((tile) =>
              tile.mode === "compact" ? (
                <CompactTile
                  key={tile.process.id}
                  tile={tile}
                  selected={selectedProcessId === tile.process.id}
                  isLinkFrom={linkMode && linkFromId === tile.process.id}
                  linkMode={linkMode}
                  draggable={!linkMode}
                  zoom={zoom}
                  onDragMoved={() => {
                    dragMovedRef.current = true;
                  }}
                  onDragEnd={(x, y) => handleTileDragEnd(tile.process.id, x, y)}
                  onSelect={() => handleCompactTileSelect(tile.process.id)}
                  onOpenWorkshop={() => openInWorkshop(tile.process.id)}
                />
              ) : (
                <DiagramTileView
                  key={tile.process.id}
                  tile={tile}
                  onOpenWorkshop={openInWorkshop}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <GodModeToolbar
        viewMode={viewMode}
        onViewModeChange={(m) => {
          setMode(m);
          setLinkMode(false);
          setLinkFromId(null);
          setSelectedLinkId(null);
        }}
        layoutMode={layoutMode}
        onLayoutModeChange={setPlantLayoutMode}
        tileCount={layout.tiles.length}
        totalCount={processes.length}
        linkCount={links.length}
        isDiagrams={isDiagrams}
        missingCount={missingCount}
        zoom={zoom}
        displayPercent={displayPercent}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={handleFit}
        onRefresh={() => void load()}
        linkMode={linkMode}
        onLinkModeChange={(on) => {
          setLinkMode(on);
          setLinkFromId(null);
          setSelectedLinkId(null);
          setSelectedProcessId(null);
        }}
        selectedLinkId={selectedLinkId}
        onDeleteLink={() => void deleteSelectedLink()}
        plantExportInput={plantExportInput}
        showBoundary={showBoundary}
        onShowBoundaryChange={setPlantShowBoundary}
        boundaryAvailable={Boolean(boundaryLayout?.hasItems)}
      />
    </div>
    </>
  );
}

function CompactTile({
  tile,
  selected = false,
  isLinkFrom,
  linkMode,
  draggable = true,
  zoom = 1,
  onDragMoved,
  onDragEnd,
  onSelect,
  onOpenWorkshop,
}: {
  tile: DiagramTile;
  selected?: boolean;
  isLinkFrom?: boolean;
  linkMode?: boolean;
  draggable?: boolean;
  zoom?: number;
  onDragMoved?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onSelect: () => void;
  onOpenWorkshop: () => void;
}) {
  const shape = normalizeIoShape(tile.process.ioShape);
  const meta = getIoShapeMeta(shape);
  const statusLabel =
    PROCESS_STATUS_LABELS[
      tile.process.status as keyof typeof PROCESS_STATUS_LABELS
    ] ?? tile.process.status;
  const hasDiagram = Boolean(tile.process.diagramMermaid?.trim());
  const [pos, setPos] = useState({ x: tile.x, y: tile.y });
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setPos({ x: tile.x, y: tile.y });
  }, [tile.x, tile.y]);

  function onTilePointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    // Workshop button handles its own clicks
    if ((e.target as HTMLElement).closest("[data-workshop-btn]")) return;

    e.stopPropagation();
    if (draggable) {
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: pos.x,
        originY: pos.y,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onTilePointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const z = zoom || 1;
    const dx = (e.clientX - d.startClientX) / z;
    const dy = (e.clientY - d.startClientY) / z;
    if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      d.moved = true;
      onDragMoved?.();
    }
    if (d.moved) {
      setPos({
        x: Math.max(0, d.originX + dx),
        y: Math.max(0, d.originY + dy),
      });
    }
  }

  function onTilePointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d?.moved) {
      const z = zoom || 1;
      const dx = (e.clientX - d.startClientX) / z;
      const dy = (e.clientY - d.startClientY) / z;
      const finalX = Math.max(0, d.originX + dx);
      const finalY = Math.max(0, d.originY + dy);
      setPos({ x: finalX, y: finalY });
      onDragEnd?.(finalX, finalY);
      onSelect(); // keep selected after move
      return;
    }
    // Click without drag = select only
    onSelect();
  }

  return (
    <div
      data-godmode-tile
      data-selected={selected ? "true" : undefined}
      onPointerDown={onTilePointerDown}
      onPointerMove={onTilePointerMove}
      onPointerUp={onTilePointerUp}
      onPointerCancel={onTilePointerUp}
      className={`absolute card bg-bg-panel border shadow-sm overflow-hidden group select-none ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${
        isLinkFrom
          ? "z-10 plant-block--link-source"
          : selected
            ? "z-10 plant-block--selected"
            : "border-border hover:border-border-strong"
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        width: tile.width,
        height: tile.height,
      }}
    >
      <div className="flex flex-col h-full p-3">
        <div className="flex items-center justify-center flex-1 text-text min-h-0 pointer-events-none">
          <IoShapeGlyph shape={shape} size="lg" className="text-text" />
        </div>
        <div
          className="text-sm font-medium text-center truncate pointer-events-none"
          title={tile.process.name}
        >
          {tile.process.name}
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 flex-wrap pointer-events-none">
          <span className="pill text-[10px]">{statusLabel}</span>
          <span
            className="text-[10px] font-mono uppercase text-text-faint"
            title={meta.label}
          >
            {shape}
          </span>
          {hasDiagram ? (
            <span title="Has diagram" className="inline-flex">
              <GitBranch className="w-3 h-3 text-green" aria-hidden />
            </span>
          ) : null}
        </div>
        {linkMode ? (
          <p className="mt-1.5 text-[10px] text-center text-text-faint pointer-events-none">
            {isLinkFrom ? "Source" : "Click as target"}
          </p>
        ) : (
          <button
            type="button"
            data-workshop-btn
            onClick={(e) => {
              e.stopPropagation();
              onOpenWorkshop();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1.5 w-full text-[11px] text-accent hover:underline inline-flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Hammer className="w-3 h-3" aria-hidden />
            Open in workshop
          </button>
        )}
      </div>
    </div>
  );
}

function DiagramTileView({
  tile,
  onOpenWorkshop,
}: {
  tile: DiagramTile;
  onOpenWorkshop: (id: string) => void;
}) {
  const scale =
    tile.diagramWidth > 0
      ? Math.min(1, MAX_DIAGRAM_WIDTH / tile.diagramWidth)
      : 1;
  const scaledW = tile.diagramWidth * scale;
  const scaledH = tile.diagramHeight * scale;
  const statusLabel =
    PROCESS_STATUS_LABELS[
      tile.process.status as keyof typeof PROCESS_STATUS_LABELS
    ] ?? tile.process.status;

  return (
    <div
      data-godmode-tile
      className="absolute card bg-bg-panel border border-border shadow-sm overflow-hidden group"
      style={{
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
      }}
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 min-h-[52px]">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate" title={tile.process.name}>
            {tile.process.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="pill text-[10px]">{statusLabel}</span>
            <span className="text-[10px] font-mono uppercase text-text-faint">
              {normalizeIoShape(tile.process.ioShape)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenWorkshop(tile.process.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-accent hover:underline shrink-0"
        >
          Open in Workshop
        </button>
      </div>

      <div
        className="flex items-center justify-center p-5 overflow-hidden"
        style={{ height: tile.height - TILE_HEADER_HEIGHT }}
      >
        {tile.error ? (
          <p className="text-xs text-amber-400 text-center px-2">
            Could not render diagram
          </p>
        ) : tile.svg ? (
          <div
            className="[&_svg]:max-w-none [&_svg]:block"
            style={{
              width: scaledW,
              height: scaledH,
            }}
            dangerouslySetInnerHTML={{ __html: tile.svg }}
          />
        ) : (
          <p className="text-xs text-text-soft">No diagram</p>
        )}
      </div>
    </div>
  );
}

function GodModeToolbar({
  viewMode,
  onViewModeChange,
  layoutMode = "function",
  onLayoutModeChange,
  tileCount,
  totalCount,
  linkCount = 0,
  isDiagrams,
  missingCount = 0,
  zoom,
  displayPercent,
  onZoomIn,
  onZoomOut,
  onFit,
  onRefresh,
  disableZoom = false,
  linkMode = false,
  onLinkModeChange,
  selectedLinkId,
  onDeleteLink,
  plantExportInput = null,
  showBoundary = true,
  onShowBoundaryChange,
  boundaryAvailable = false,
}: {
  viewMode: GodModeViewMode;
  onViewModeChange: (m: GodModeViewMode) => void;
  layoutMode?: PlantLayoutMode;
  onLayoutModeChange?: (m: PlantLayoutMode) => void;
  tileCount: number;
  totalCount: number;
  linkCount?: number;
  isDiagrams: boolean;
  missingCount?: number;
  zoom?: number;
  displayPercent?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRefresh: () => void;
  disableZoom?: boolean;
  linkMode?: boolean;
  onLinkModeChange?: (on: boolean) => void;
  selectedLinkId?: string | null;
  onDeleteLink?: () => void;
  plantExportInput?: PlantExportInput | null;
  showBoundary?: boolean;
  onShowBoundaryChange?: (on: boolean) => void;
  /** True when entry/exit processes have inputs/outputs to frame. */
  boundaryAvailable?: boolean;
}) {
  const z = zoom ?? 1;
  const pct = displayPercent ?? Math.round(z * 100);

  return (
    <div className="shrink-0 border-t border-border bg-bg/90 px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
          <button
            type="button"
            onClick={() => onViewModeChange("compact")}
            className={`px-2.5 py-1.5 inline-flex items-center gap-1 ${
              viewMode === "compact"
                ? "bg-bg-muted text-text-strong"
                : "bg-bg-panel text-text-muted hover:bg-bg-subtle"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Compact
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("diagrams")}
            className={`px-2.5 py-1.5 inline-flex items-center gap-1 border-l border-border ${
              viewMode === "diagrams"
                ? "bg-bg-muted text-text-strong"
                : "bg-bg-panel text-text-muted hover:bg-bg-subtle"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Diagrams
          </button>
        </div>
        {!isDiagrams && onLayoutModeChange ? (
          <div
            className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0"
            role="group"
            aria-label="Plant layout"
          >
            {PLANT_LAYOUT_MODES.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => onLayoutModeChange(m)}
                title={
                  m === "function"
                    ? "Group by function / department"
                    : m === "flow"
                      ? "Layer by process links (left → right)"
                      : "Drag tiles freely; positions saved for this business"
                }
                className={`px-2.5 py-1.5 ${
                  i > 0 ? "border-l border-border" : ""
                } ${
                  layoutMode === m
                    ? "bg-bg-muted text-text-strong"
                    : "bg-bg-panel text-text-muted hover:bg-bg-subtle"
                }`}
              >
                {PLANT_LAYOUT_MODE_LABELS[m]}
              </button>
            ))}
          </div>
        ) : null}
        {!isDiagrams && onLinkModeChange ? (
          <button
            type="button"
            onClick={() => onLinkModeChange(!linkMode)}
            className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shrink-0 ${
              linkMode
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-bg-panel text-text-muted hover:bg-bg-subtle"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            {linkMode ? "Linking…" : "Link mode"}
          </button>
        ) : null}
        {!isDiagrams && onShowBoundaryChange ? (
          <button
            type="button"
            onClick={() => onShowBoundaryChange(!showBoundary)}
            disabled={!boundaryAvailable && !showBoundary}
            className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shrink-0 ${
              showBoundary && boundaryAvailable
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-bg-panel text-text-muted hover:bg-bg-subtle"
            } disabled:opacity-40`}
            title={
              boundaryAvailable
                ? "Show inputs into the plant and outcomes leaving it (from entry/exit process I/O)"
                : "Add inputs on entry processes and outputs on exit processes to frame outside I/O"
            }
          >
            <Waypoints className="w-3.5 h-3.5" />
            Outside I/O
          </button>
        ) : null}
        {selectedLinkId && onDeleteLink ? (
          <button
            type="button"
            onClick={onDeleteLink}
            className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red/40 bg-red/10 text-red hover:bg-red/15 shrink-0 font-medium"
            title="Delete selected plant link"
          >
            <Unlink className="w-3.5 h-3.5" />
            Delete link
          </button>
        ) : null}
        <div className="text-xs text-text-muted truncate">
          {isDiagrams ? (
            <>
              {tileCount} diagram{tileCount !== 1 ? "s" : ""}
              {missingCount > 0 && (
                <span className="text-text-soft">
                  {" "}
                  · {missingCount} without diagrams
                </span>
              )}
            </>
          ) : (
            <>
              {tileCount} process block{tileCount !== 1 ? "s" : ""}
              {linkCount > 0 ? (
                <span className="text-text-soft">
                  {" "}
                  · {linkCount} link{linkCount !== 1 ? "s" : ""}
                </span>
              ) : null}
              {totalCount > 0 && tileCount !== totalCount ? (
                <span className="text-text-soft"> · {totalCount} total</span>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PlantExportMenu
          input={plantExportInput}
          disabled={isDiagrams}
        />

        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-bg-muted" />

        <button
          type="button"
          onClick={onZoomOut}
          disabled={disableZoom || z <= MIN_ZOOM}
          className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-xs text-text-muted tabular-nums min-w-[3.5rem] text-center">
          {pct}%
        </span>

        <button
          type="button"
          onClick={onZoomIn}
          disabled={disableZoom || z >= MAX_ZOOM}
          className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-bg-muted mx-1" />

        <button
          type="button"
          onClick={onFit}
          disabled={disableZoom}
          className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text transition-colors flex items-center gap-1.5 text-xs px-3 disabled:opacity-40"
          title="Fit all"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fit all
        </button>
      </div>
    </div>
  );
}
