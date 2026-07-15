"use client";

import { Check, Loader2, Trash2, X } from "lucide-react";
import {
  IO_SHAPE_IDS,
  IO_SHAPE_META,
  type IoShapeId,
} from "@/lib/io-shape";
import type { ProposedDraft } from "@/lib/foundation-extract";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";

export type ReviewDraftRow = ProposedDraft & {
  selected: boolean;
  localKey: string;
};

interface DraftReviewPanelProps {
  open: boolean;
  drafts: ReviewDraftRow[];
  applying: boolean;
  sourceLabel?: string;
  onChange: (drafts: ReviewDraftRow[]) => void;
  onApply: () => void;
  onDismiss: () => void;
}

export function DraftReviewPanel({
  open,
  drafts,
  applying,
  sourceLabel,
  onChange,
  onApply,
  onDismiss,
}: DraftReviewPanelProps) {
  if (!open || drafts.length === 0) return null;

  const selectedCount = drafts.filter((d) => d.selected).length;

  function updateRow(localKey: string, patch: Partial<ReviewDraftRow>) {
    onChange(
      drafts.map((d) => (d.localKey === localKey ? { ...d, ...patch } : d))
    );
  }

  function removeRow(localKey: string) {
    onChange(drafts.filter((d) => d.localKey !== localKey));
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-2xl card border border-border-strong bg-bg-elevated shadow-lg max-h-[min(70vh,520px)] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-strong">
              Review draft processes
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {selectedCount} of {drafts.length} selected
              {sourceLabel ? ` · from ${sourceLabel}` : ""}
              {" · "}duplicates update existing drafts (not forged)
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={applying}
            className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted"
            aria-label="Dismiss draft review"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-3 space-y-2">
          {drafts.map((row) => (
            <li
              key={row.localKey}
              className={`rounded-xl border p-3 ${
                row.selected
                  ? "border-border-strong bg-bg-panel"
                  : "border-border opacity-60 bg-bg-subtle"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={row.selected}
                  disabled={applying}
                  onChange={(e) =>
                    updateRow(row.localKey, { selected: e.target.checked })
                  }
                  aria-label={`Include ${row.name}`}
                />
                <IoShapeGlyph
                  shape={row.ioShape}
                  size="md"
                  className="text-text-muted mt-1 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="input w-full text-sm py-1.5"
                    value={row.name}
                    disabled={applying}
                    onChange={(e) =>
                      updateRow(row.localKey, { name: e.target.value })
                    }
                  />
                  <textarea
                    className="input w-full text-xs min-h-[48px] resize-y py-1.5"
                    value={row.description ?? ""}
                    placeholder="Description"
                    disabled={applying}
                    onChange={(e) =>
                      updateRow(row.localKey, {
                        description: e.target.value,
                      })
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="input text-xs py-1 flex-1 min-w-[7rem]"
                      value={row.department ?? ""}
                      placeholder="Function"
                      disabled={applying}
                      onChange={(e) =>
                        updateRow(row.localKey, {
                          department: e.target.value,
                        })
                      }
                    />
                    <select
                      className="input text-xs py-1 w-[7.5rem]"
                      value={(row.ioShape as string) || "siso"}
                      disabled={applying}
                      onChange={(e) =>
                        updateRow(row.localKey, {
                          ioShape: e.target.value as IoShapeId,
                        })
                      }
                    >
                      {IO_SHAPE_IDS.map((id) => (
                        <option key={id} value={id}>
                          {IO_SHAPE_META[id].glyph} {id}
                        </option>
                      ))}
                    </select>
                  </div>
                  {row.isDuplicate ? (
                    <p className="text-[10px] text-amber-400">
                      Name matches existing process — will upsert if still draft
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.localKey)}
                  disabled={applying}
                  className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted shrink-0"
                  title="Discard from list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={onDismiss}
            disabled={applying}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn-primary text-xs inline-flex items-center gap-1.5"
            onClick={onApply}
            disabled={applying || selectedCount === 0}
          >
            {applying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Seed {selectedCount} draft{selectedCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Build review rows from proposed drafts. */
export function toReviewRows(drafts: ProposedDraft[]): ReviewDraftRow[] {
  return drafts.map((d, i) => ({
    ...d,
    selected: true,
    localKey: `${d.name}-${i}-${Date.now()}`,
  }));
}
