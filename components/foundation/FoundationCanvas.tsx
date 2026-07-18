"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Check,
  Hammer,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import type { FoundationProcessCard } from "@/lib/foundation";
import type { ProcessLinkDto } from "@/lib/process-links";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";
import { getIoShapeMeta } from "@/lib/io-shape";
import { PROCESS_STATUS_LABELS, isProcessForged } from "@/lib/process-status";
import {
  getDeptLabelY,
  layoutPlant,
  PLANT_LAYOUT_MODE_LABELS,
  PLANT_LAYOUT_MODES,
  PLANT_TILE,
  type PlantLayoutMode,
  type PlantManualPositions,
} from "@/lib/plant-layout";
import {
  loadPlantLayoutMode,
  loadPlantPositions,
  savePlantLayoutMode,
  upsertPlantPosition,
} from "@/lib/plant-layout-prefs";
import { PlantEdges } from "@/components/plant/PlantEdges";

interface FoundationCanvasProps {
  processes: FoundationProcessCard[];
  links: ProcessLinkDto[];
  /** Active business for layout prefs (mode + manual positions). */
  businessId?: string | null;
  selectedProcessId: string | null;
  onSelectProcess: (id: string | null) => void;
  onOpenWorkshop: (id: string) => void;
  onAddDraft: () => void;
  /** Optional empty-state extras (e.g. template starters, 6.7). */
  emptyExtra?: ReactNode;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string, name: string) => Promise<void>;
  linkMode: boolean;
  onLinkModeChange: (on: boolean) => void;
  linkFromId: string | null;
  onLinkFromChange: (id: string | null) => void;
  onCreateLink: (fromId: string, toId: string) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
  selectedLinkId: string | null;
  onSelectLink: (id: string | null) => void;
}

export function FoundationCanvas({
  processes,
  links,
  businessId = null,
  selectedProcessId,
  onSelectProcess,
  onOpenWorkshop,
  onAddDraft,
  emptyExtra,
  onRename,
  onDelete,
  linkMode,
  onLinkModeChange,
  linkFromId,
  onLinkFromChange,
  onCreateLink,
  onDeleteLink,
  selectedLinkId,
  onSelectLink,
}: FoundationCanvasProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [layoutMode, setLayoutMode] = useState<PlantLayoutMode>("function");
  const [manualPositions, setManualPositions] = useState<PlantManualPositions>({});
  const dragMovedRef = useRef(false);

  useEffect(() => {
    setLayoutMode(loadPlantLayoutMode(businessId));
    setManualPositions(loadPlantPositions(businessId));
  }, [businessId]);

  const layout = useMemo(
    () =>
      layoutPlant(
        processes.map((p) => ({ id: p.id, department: p.department })),
        {
          mode: layoutMode,
          edges: links.map((l) => ({
            fromId: l.fromProcessId,
            toId: l.toProcessId,
          })),
          positions: manualPositions,
        },
      ),
    [processes, links, layoutMode, manualPositions],
  );

  function setPlantLayoutMode(next: PlantLayoutMode) {
    setLayoutMode(next);
    savePlantLayoutMode(businessId, next);
    if (next === "manual") {
      setManualPositions(loadPlantPositions(businessId));
    }
  }

  function handleTileDragEnd(processId: string, x: number, y: number) {
    const next = upsertPlantPosition(businessId, processId, x, y);
    setManualPositions(next);
    if (layoutMode !== "manual") {
      setPlantLayoutMode("manual");
    }
  }

  const processById = useMemo(
    () => new Map(processes.map((p) => [p.id, p])),
    [processes]
  );

  if (processes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[280px]">
        <div className="max-w-lg text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bg-elevated border border-border text-text-muted">
            <IoShapeGlyph shape="siso" size="lg" className="text-text-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-strong">
              Sketch the plant
            </h2>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Talk with Overlord about how the business works — channels, services,
              handoffs. Seed a template draft, add a blank block, then open Workshop
              to refine each map.
            </p>
          </div>
          {emptyExtra}
          <button
            type="button"
            onClick={onAddDraft}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add blank draft
          </button>
        </div>
      </div>
    );
  }

  async function handleTileClick(procId: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (linkMode) {
      if (!linkFromId) {
        onLinkFromChange(procId);
        onSelectProcess(procId);
        return;
      }
      if (linkFromId === procId) {
        onLinkFromChange(null);
        return;
      }
      setLinking(true);
      try {
        await onCreateLink(linkFromId, procId);
        onLinkFromChange(null);
      } finally {
        setLinking(false);
      }
      return;
    }
    onSelectProcess(procId);
    onSelectLink(null);
  }

  const showDeptLabels = layoutMode === "function" && layout.departments.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-text-strong">Plant sketch</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {processes.length} block{processes.length === 1 ? "" : "s"}
            {links.length > 0
              ? ` · ${links.length} link${links.length === 1 ? "" : "s"}`
              : ""}
            {linkMode
              ? linkFromId
                ? " · click a target process"
                : " · click a source process"
              : layoutMode === "manual"
                ? " · drag tiles to arrange"
                : " · open Workshop to deepen a unit"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div
            className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0"
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
          <button
            type="button"
            onClick={() => {
              onLinkModeChange(!linkMode);
              onLinkFromChange(null);
              onSelectLink(null);
            }}
            className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              linkMode
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-bg-panel text-text-muted hover:bg-bg-subtle"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            {linkMode ? "Linking…" : "Link mode"}
          </button>
          {selectedLinkId ? (
            <button
              type="button"
              onClick={() => void onDeleteLink(selectedLinkId)}
              className="btn-secondary text-xs inline-flex items-center gap-1.5 text-red"
            >
              <Unlink className="w-3.5 h-3.5" />
              Delete link
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddDraft}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add draft
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 min-h-0">
        <div
          className="relative mx-auto"
          style={{
            width: layout.canvasWidth,
            height: layout.canvasHeight,
            minHeight: 400,
          }}
        >
          <PlantEdges
            links={links}
            byId={layout.byId}
            canvasWidth={layout.canvasWidth}
            canvasHeight={layout.canvasHeight}
            selectedLinkId={selectedLinkId}
            onSelectLink={(id) => {
              onSelectLink(id);
              onSelectProcess(null);
            }}
          />

          {showDeptLabels
            ? layout.departments.map((dept) => (
                <div
                  key={dept}
                  className="absolute text-[10px] uppercase tracking-widest text-text-muted font-medium"
                  style={{
                    top: getDeptLabelY(dept, layout.tiles),
                    left: PLANT_TILE.padding,
                  }}
                >
                  {dept}
                </div>
              ))
            : null}

          {layout.tiles.map((pos) => {
            const proc = processById.get(pos.id);
            if (!proc) return null;
            const selected = proc.id === selectedProcessId;
            const isLinkFrom = linkMode && linkFromId === proc.id;
            const meta = getIoShapeMeta(proc.ioShape);
            const statusLabel =
              PROCESS_STATUS_LABELS[
                proc.status as keyof typeof PROCESS_STATUS_LABELS
              ] ?? proc.status;
            const isEditing = editingId === proc.id;
            const canMutate = !isProcessForged(proc.status);

            return (
              <FoundationPlantTile
                key={proc.id}
                proc={proc}
                pos={pos}
                selected={selected}
                isLinkFrom={isLinkFrom}
                linking={linking}
                linkMode={linkMode}
                draggable={layoutMode === "manual" && !linkMode}
                isEditing={isEditing}
                editName={editName}
                saving={saving}
                canMutate={canMutate}
                statusLabel={statusLabel}
                metaLabel={meta.label}
                onTileClick={() => void handleTileClick(proc.id)}
                onDragMoved={() => {
                  dragMovedRef.current = true;
                }}
                onDragEnd={(x, y) => handleTileDragEnd(proc.id, x, y)}
                onOpenWorkshop={() => onOpenWorkshop(proc.id)}
                onStartRename={() => {
                  setEditingId(proc.id);
                  setEditName(proc.name);
                }}
                onEditNameChange={setEditName}
                onCancelEdit={() => setEditingId(null)}
                onSaveRename={async () => {
                  if (!onRename || !editName.trim()) return;
                  setSaving(true);
                  try {
                    await onRename(proc.id, editName.trim());
                    setEditingId(null);
                  } finally {
                    setSaving(false);
                  }
                }}
                onDelete={
                  onDelete
                    ? () => void onDelete(proc.id, proc.name)
                    : undefined
                }
                showRename={Boolean(onRename)}
                showDelete={Boolean(onDelete)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Tile with optional manual drag; keeps rename/delete UI in place. */
function FoundationPlantTile({
  proc,
  pos,
  selected,
  isLinkFrom,
  linking,
  linkMode,
  draggable,
  isEditing,
  editName,
  saving,
  canMutate,
  statusLabel,
  metaLabel,
  onTileClick,
  onDragMoved,
  onDragEnd,
  onOpenWorkshop,
  onStartRename,
  onEditNameChange,
  onCancelEdit,
  onSaveRename,
  onDelete,
  showRename,
  showDelete,
}: {
  proc: FoundationProcessCard;
  pos: { x: number; y: number; width: number; height: number };
  selected: boolean;
  isLinkFrom: boolean;
  linking: boolean;
  linkMode: boolean;
  draggable: boolean;
  isEditing: boolean;
  editName: string;
  saving: boolean;
  canMutate: boolean;
  statusLabel: string;
  metaLabel: string;
  onTileClick: () => void;
  onDragMoved: () => void;
  onDragEnd: (x: number, y: number) => void;
  onOpenWorkshop: () => void;
  onStartRename: () => void;
  onEditNameChange: (v: string) => void;
  onCancelEdit: () => void;
  onSaveRename: () => Promise<void>;
  onDelete?: () => void;
  showRename: boolean;
  showDelete: boolean;
}) {
  const [xy, setXy] = useState({ x: pos.x, y: pos.y });
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setXy({ x: pos.x, y: pos.y });
  }, [pos.x, pos.y]);

  function onPointerDown(e: ReactPointerEvent) {
    if (!draggable || e.button !== 0 || isEditing) return;
    e.stopPropagation();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: xy.x,
      originY: xy.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      d.moved = true;
      onDragMoved();
    }
    if (d.moved) {
      setXy({
        x: Math.max(0, d.originX + dx),
        y: Math.max(0, d.originY + dy),
      });
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d?.moved) {
      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      const finalX = Math.max(0, d.originX + dx);
      const finalY = Math.max(0, d.originY + dy);
      setXy({ x: finalX, y: finalY });
      onDragEnd(finalX, finalY);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTileClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTileClick();
        }
      }}
      className={`absolute card bg-bg-panel border shadow-sm overflow-hidden group transition-colors ${
        draggable ? "cursor-move" : "cursor-pointer"
      } ${
        isLinkFrom
          ? "border-accent ring-2 ring-accent/40"
          : selected
            ? "border-border-strong bg-bg-muted ring-1 ring-[var(--selected)]/50"
            : "border-border hover:border-border-strong"
      } ${linking ? "opacity-80" : ""}`}
      style={{
        left: xy.x,
        top: xy.y,
        width: pos.width,
        height: pos.height,
      }}
    >
      <div className="flex flex-col h-full p-3">
        <div className="flex items-center justify-center flex-1 text-text min-h-0">
          <IoShapeGlyph shape={proc.ioShape} size="lg" className="text-text" />
        </div>
        {isEditing ? (
          <form
            className="space-y-2"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              await onSaveRename();
            }}
          >
            <input
              className="input w-full text-sm py-1"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              autoFocus
              disabled={saving}
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                className="p-1 rounded hover:bg-bg-subtle"
                onClick={onCancelEdit}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="submit"
                className="p-1 rounded hover:bg-bg-subtle text-green"
                disabled={saving}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <div
            className="text-sm font-medium text-center truncate"
            title={proc.name}
          >
            {proc.name}
          </div>
        )}
        <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
          <span className="pill text-[10px]">{statusLabel}</span>
          <span
            className="text-[10px] font-mono uppercase text-text-faint"
            title={metaLabel}
          >
            {proc.ioShape}
          </span>
        </div>
        {!linkMode ? (
          <div className="mt-1.5 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenWorkshop();
              }}
              className="w-full text-[11px] text-accent hover:underline inline-flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100"
            >
              <Hammer className="w-3 h-3" />
              Workshop
            </button>
            {canMutate && (showRename || showDelete) ? (
              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {showRename ? (
                  <button
                    type="button"
                    title="Rename"
                    className="p-1 rounded hover:bg-bg-subtle text-text-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartRename();
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                ) : null}
                {showDelete && onDelete ? (
                  <button
                    type="button"
                    title="Delete draft"
                    className="p-1 rounded hover:bg-bg-subtle text-text-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-1.5 text-[10px] text-center text-text-faint">
            {isLinkFrom ? "Source" : "Click as target"}
          </p>
        )}
      </div>
    </div>
  );
}
