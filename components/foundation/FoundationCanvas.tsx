"use client";

import { useMemo, useState } from "react";
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
  layoutPlantByDepartment,
  PLANT_TILE,
} from "@/lib/plant-layout";
import { PlantEdges } from "@/components/plant/PlantEdges";

interface FoundationCanvasProps {
  processes: FoundationProcessCard[];
  links: ProcessLinkDto[];
  selectedProcessId: string | null;
  onSelectProcess: (id: string | null) => void;
  onOpenWorkshop: (id: string) => void;
  onAddDraft: () => void;
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
  selectedProcessId,
  onSelectProcess,
  onOpenWorkshop,
  onAddDraft,
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

  const layout = useMemo(
    () =>
      layoutPlantByDepartment(
        processes.map((p) => ({ id: p.id, department: p.department }))
      ),
    [processes]
  );

  const processById = useMemo(
    () => new Map(processes.map((p) => [p.id, p])),
    [processes]
  );

  if (processes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[280px]">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bg-elevated border border-border text-text-muted">
            <IoShapeGlyph shape="siso" size="lg" className="text-text-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-strong">
              Sketch the plant
            </h2>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Talk with Hermes about how the business works — channels, services,
              handoffs. Add draft process blocks here as lightweight unit ops,
              then open Workshop to refine each map.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddDraft}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add first draft
          </button>
        </div>
      </div>
    );
  }

  async function handleTileClick(procId: string) {
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
              : " · open Workshop to deepen a unit"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

          {layout.departments.map((dept) => (
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
          ))}

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
              <div
                key={proc.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleTileClick(proc.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void handleTileClick(proc.id);
                  }
                }}
                className={`absolute card bg-bg-panel border shadow-sm overflow-hidden group cursor-pointer transition-colors ${
                  isLinkFrom
                    ? "border-accent ring-2 ring-accent/40"
                    : selected
                      ? "border-border-strong bg-bg-muted ring-1 ring-[var(--selected)]/50"
                      : "border-border hover:border-border-strong"
                } ${linking ? "opacity-80" : ""}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                }}
              >
                <div className="flex flex-col h-full p-3">
                  <div className="flex items-center justify-center flex-1 text-text min-h-0">
                    <IoShapeGlyph
                      shape={proc.ioShape}
                      size="lg"
                      className="text-text"
                    />
                  </div>
                  {isEditing ? (
                    <form
                      className="space-y-2"
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!onRename || !editName.trim()) return;
                        setSaving(true);
                        try {
                          await onRename(proc.id, editName.trim());
                          setEditingId(null);
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <input
                        className="input w-full text-sm py-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        disabled={saving}
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-bg-subtle"
                          onClick={() => setEditingId(null)}
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
                      title={meta.label}
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
                          onOpenWorkshop(proc.id);
                        }}
                        className="w-full text-[11px] text-accent hover:underline inline-flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100"
                      >
                        <Hammer className="w-3 h-3" />
                        Workshop
                      </button>
                      {canMutate && (onRename || onDelete) ? (
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onRename ? (
                            <button
                              type="button"
                              title="Rename"
                              className="p-1 rounded hover:bg-bg-subtle text-text-muted"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(proc.id);
                                setEditName(proc.name);
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          ) : null}
                          {onDelete ? (
                            <button
                              type="button"
                              title="Delete draft"
                              className="p-1 rounded hover:bg-bg-subtle text-text-muted"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDelete(proc.id, proc.name);
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
          })}
        </div>
      </div>
    </div>
  );
}
