"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export function NewProjectDialog({ open, creating, onClose, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
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
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;
    onCreate(trimmedName, description.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close new project dialog"
        onClick={creating ? undefined : onClose}
        disabled={creating}
      />
      <div className="relative w-full max-w-md card p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={creating}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6 pr-8">
          <h2 className="text-xl font-semibold tracking-tight">New Project</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Give your project a name and optional description before opening the workshop.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
              Name
            </label>
            <input
              id="project-name"
              className="input w-full text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp Operations"
              autoFocus
              disabled={creating}
              required
            />
          </div>

          <div>
            <label htmlFor="project-description" className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
              Description <span className="normal-case tracking-normal text-zinc-600">(optional)</span>
            </label>
            <textarea
              id="project-description"
              className="input w-full text-sm min-h-[88px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              disabled={creating}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="btn-primary text-sm"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create &amp; Open Workshop
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}