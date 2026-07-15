"use client";

import { useState } from "react";
import { Check, Hammer, Pencil, Plus, Trash2, X } from "lucide-react";
import type { FoundationProcessCard } from "@/lib/foundation";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";
import { getIoShapeMeta } from "@/lib/io-shape";
import { PROCESS_STATUS_LABELS, isProcessForged } from "@/lib/process-status";

interface FoundationCanvasProps {
  processes: FoundationProcessCard[];
  selectedProcessId: string | null;
  onSelectProcess: (id: string) => void;
  onOpenWorkshop: (id: string) => void;
  onAddDraft: () => void;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string, name: string) => Promise<void>;
}

function groupByDepartment(
  processes: FoundationProcessCard[]
): Map<string, FoundationProcessCard[]> {
  const map = new Map<string, FoundationProcessCard[]>();
  for (const p of processes) {
    const dept = p.department || "Uncategorized";
    const list = map.get(dept) ?? [];
    list.push(p);
    map.set(dept, list);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function FoundationCanvas({
  processes,
  selectedProcessId,
  onSelectProcess,
  onOpenWorkshop,
  onAddDraft,
  onRename,
  onDelete,
}: FoundationCanvasProps) {
  const grouped = groupByDepartment(processes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="flex-1 overflow-auto p-6 min-h-0">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-sm font-semibold text-text-strong">Plant sketch</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {processes.length} process block{processes.length === 1 ? "" : "s"} ·
            open Workshop to deepen a unit
          </p>
        </div>
        <button
          type="button"
          onClick={onAddDraft}
          className="btn-secondary text-xs inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add draft
        </button>
      </div>

      <div className="space-y-8">
        {[...grouped.entries()].map(([dept, procs]) => (
          <section key={dept}>
            <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-3">
              {dept}
            </h3>
            <div className="flex flex-wrap gap-4">
              {procs.map((proc) => {
                const selected = proc.id === selectedProcessId;
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
                    onClick={() => onSelectProcess(proc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectProcess(proc.id);
                      }
                    }}
                    className={`w-[200px] card bg-bg-panel border p-4 cursor-pointer transition-colors group ${
                      selected
                        ? "border-border-strong bg-bg-muted ring-1 ring-[var(--selected)]/50"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-center justify-center py-3 text-text">
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
                      <div className="text-sm font-medium text-center truncate" title={proc.name}>
                        {proc.name}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="pill text-[10px]">{statusLabel}</span>
                      <span
                        className="text-[10px] font-mono uppercase text-text-faint"
                        title={meta.label}
                      >
                        {proc.ioShape}
                      </span>
                    </div>
                    {proc.description ? (
                      <p className="mt-2 text-[11px] text-text-muted line-clamp-2 text-center">
                        {proc.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenWorkshop(proc.id);
                        }}
                        className="w-full text-[11px] text-accent hover:underline inline-flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100"
                      >
                        <Hammer className="w-3 h-3" />
                        Open in Workshop
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
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
