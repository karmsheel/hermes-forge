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
  Loader2,
  Maximize2,
  RefreshCw,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useShell } from "@/components/shell/ShellContext";
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
}

function groupByDepartment(processes: ProcessSummary[]): Map<string, ProcessSummary[]> {
  const groups = new Map<string, ProcessSummary[]>();
  for (const proc of processes) {
    const dept = (proc.department || "Uncategorized").trim();
    const list = groups.get(dept) ?? [];
    list.push(proc);
    groups.set(dept, list);
  }
  return new Map(
    [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function layoutTiles(
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
      const scale = item.diagramWidth > 0
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
  const first = tiles.find((t) => t.department === dept);
  return first ? first.y - DEPT_HEADER_HEIGHT : CANVAS_PADDING;
}

interface GodModeCanvasProps {
  onStatsChange?: (stats: {
    total: number;
    withDiagrams: number;
    businessName: string | null;
  }) => void;
}

export function GodModeCanvas({ onStatsChange }: GodModeCanvasProps) {
  const router = useRouter();
  const { resolved } = useTheme();
  const { currentBusiness } = useShell();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const hasFitRef = useRef(false);

  const isDark = resolved === "dark";

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

  const load = useCallback(async () => {
    setLoading(true);
    hasFitRef.current = false;
    try {
      const res = await fetch("/api/processes");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      const processes: ProcessSummary[] = data.processes || [];
      const biz = data.business;

      if (!biz) {
        setBusinessName(null);
        setBusinessId(null);
        setTotalCount(0);
        setLayout(null);
        onStatsChange?.({ total: 0, withDiagrams: 0, businessName: null });
        return;
      }

      setBusinessName(biz.name);
      setBusinessId(biz.id);
      setTotalCount(processes.length);

      const withDiagrams = processes.filter((p) => p.diagramMermaid?.trim());
      onStatsChange?.({
        total: processes.length,
        withDiagrams: withDiagrams.length,
        businessName: biz.name,
      });

      if (withDiagrams.length === 0) {
        setLayout(null);
        return;
      }

      setRendering(true);
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

      const nextLayout = layoutTiles(renderJobs);
      setLayout(nextLayout);
    } catch {
      toast.error("Failed to load God Mode view");
      setLayout(null);
    } finally {
      setLoading(false);
      setRendering(false);
    }
  }, [isDark, onStatsChange, router]);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  useEffect(() => {
    if (!layout || hasFitRef.current) return;
    hasFitRef.current = true;
    fitToCanvas(layout.canvasWidth, layout.canvasHeight);
  }, [layout, fitToCanvas]);

  const deptPositions = useMemo(() => {
    if (!layout) return [];
    return layout.departments.map((dept) => ({
      dept,
      y: getDeptLabelY(dept, layout.tiles),
    }));
  }, [layout]);

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(3)));
  }

  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(3)));
  }

  function handleFit() {
    if (layout) {
      fitToCanvas(layout.canvasWidth, layout.canvasHeight);
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
    if (target.closest("[data-godmode-tile]")) return;

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!businessName) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center card max-w-lg p-10">
          <Building2 className="w-10 h-10 text-text-soft mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No active business</h2>
          <p className="text-sm text-text-muted mb-6">
            Select or create a business to view all process maps.
          </p>
          <Link href="/projects" className="btn-primary text-sm inline-flex items-center gap-2">
            Go to Functions <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!layout || layout.tiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center card max-w-xl p-10">
          <GitBranch className="w-10 h-10 text-text-soft mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No diagrams yet</h2>
          <p className="text-sm text-text-muted mb-2">
            {totalCount === 0
              ? "This business has no processes yet."
              : `${totalCount} process${totalCount !== 1 ? "es" : ""} exist, but none have diagrams.`}
          </p>
          <p className="text-xs text-text-soft mb-6">
            Map processes in the Workshop — their diagrams will appear here automatically.
          </p>
          <Link href="/workshop" className="btn-primary text-sm inline-flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Open Workshop
          </Link>
        </div>
      </div>
    );
  }

  const displayPercent = Math.round(zoom * 100);
  const missingCount = totalCount - layout.tiles.length;

  return (
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
            width: layout.canvasWidth,
            height: layout.canvasHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {deptPositions.map(({ dept, y }) => (
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
          ))}

          {layout.tiles.map((tile) => {
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
                key={tile.process.id}
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
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInWorkshop(tile.process.id)}
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
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-bg/90 px-4 py-2 flex items-center justify-between gap-4">
        <div className="text-xs text-text-muted truncate">
          {layout.tiles.length} diagram{layout.tiles.length !== 1 ? "s" : ""}
          {missingCount > 0 && (
            <span className="text-text-soft">
              {" "}
              · {missingCount} process{missingCount !== 1 ? "es" : ""} without diagrams
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-bg-muted" />

          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs text-text-muted tabular-nums min-w-[3.5rem] text-center">
            {displayPercent}%
          </span>

          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-bg-muted mx-1" />

          <button
            type="button"
            onClick={handleFit}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text transition-colors flex items-center gap-1.5 text-xs px-3"
            title="Fit all"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit all
          </button>
        </div>
      </div>
    </div>
  );
}