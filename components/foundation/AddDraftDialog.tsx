"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  IO_SHAPE_IDS,
  IO_SHAPE_META,
  type IoShapeId,
} from "@/lib/io-shape";
import type { SeedDraftInput } from "@/lib/foundation";

interface AddDraftDialogProps {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (draft: SeedDraftInput) => void;
}

export function AddDraftDialog({
  open,
  creating,
  onClose,
  onSubmit,
}: AddDraftDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [ioShape, setIoShape] = useState<IoShapeId>("siso");
  const [inputs, setInputs] = useState("");
  const [outputs, setOutputs] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setDepartment("");
    setIoShape("siso");
    setInputs("");
    setOutputs("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !creating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, creating, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    onSubmit({
      name: trimmed,
      description: description.trim() || null,
      department: department.trim() || null,
      ioShape,
      inputs: inputs.trim() || null,
      outputs: outputs.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close add draft dialog"
        onClick={creating ? undefined : onClose}
        disabled={creating}
      />
      <div className="relative w-full max-w-md card p-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={creating}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pr-8">
          <h2 className="text-lg font-semibold tracking-tight">Add draft process</h2>
          <p className="text-sm text-text-muted mt-1">
            Lightweight plant block. Refine the full map later in Workshop.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Name
            </label>
            <input
              className="input w-full text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order fulfillment"
              autoFocus
              disabled={creating}
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Description
            </label>
            <textarea
              className="input w-full text-sm min-h-[72px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this unit does in one sentence"
              disabled={creating}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-text-muted mb-2">
                Function
              </label>
              <input
                className="input w-full text-sm"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Auto if blank"
                disabled={creating}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-text-muted mb-2">
                Shape
              </label>
              <select
                className="input w-full text-sm"
                value={ioShape}
                onChange={(e) => setIoShape(e.target.value as IoShapeId)}
                disabled={creating}
              >
                {IO_SHAPE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {IO_SHAPE_META[id].glyph} {id.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Inputs (optional)
            </label>
            <input
              className="input w-full text-sm"
              value={inputs}
              onChange={(e) => setInputs(e.target.value)}
              placeholder="Lead form + CRM"
              disabled={creating}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Outputs (optional)
            </label>
            <input
              className="input w-full text-sm"
              value={outputs}
              onChange={(e) => setOutputs(e.target.value)}
              placeholder="Qualified lead + Slack ping"
              disabled={creating}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="btn-primary text-sm inline-flex items-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
