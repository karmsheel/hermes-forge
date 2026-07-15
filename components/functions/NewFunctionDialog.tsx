"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Overlay } from "@/components/ui/Overlay";
import {
  detectFunctionSuggestions,
  SUGGESTED_FUNCTION_NAMES,
} from "@/lib/functions";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (fn: { id: string; name: string; description: string | null }) => void;
  existingNames: string[];
  industry?: string | null;
  description?: string | null;
  goals?: string | null;
};

export function NewFunctionDialog({
  open,
  onClose,
  onCreated,
  existingNames,
  industry,
  description,
  goals,
}: Props) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setNotes("");
    setError(null);
    setSaving(false);
    setDetected([]);
  }, [open]);

  const existingLower = useMemo(
    () => new Set(existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
    [existingNames],
  );

  const chips = useMemo(() => {
    const base = detected.length > 0 ? detected : [...SUGGESTED_FUNCTION_NAMES];
    return base.filter((n) => !existingLower.has(n.toLowerCase()));
  }, [detected, existingLower]);

  function runDetect() {
    const next = detectFunctionSuggestions({
      industry,
      description,
      goals,
      existing: existingNames,
    });
    setDetected(next);
    if (next.length === 0) {
      setError("No new functions to suggest — try a custom name.");
    } else {
      setError(null);
      if (!name.trim()) setName(next[0]);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a function name.");
      return;
    }
    if (existingLower.has(trimmed.toLowerCase())) {
      setError(`“${trimmed}” is already on the map.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/functions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create function");
        return;
      }
      onCreated(data.function);
      onClose();
    } catch {
      setError("Could not create function");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="New function"
      description="Add a business area to the map. You can move workflows into it afterward."
      size="sm"
    >
      <form onSubmit={handleCreate} className="new-function-dialog">
        <label className="new-function-dialog__label" htmlFor="new-function-name">
          Function name
        </label>
        <input
          id="new-function-name"
          className="new-function-dialog__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing, Operations"
          autoFocus
          maxLength={80}
          disabled={saving}
        />

        <label className="new-function-dialog__label" htmlFor="new-function-notes">
          Notes <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="new-function-notes"
          className="new-function-dialog__textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What does this function own?"
          rows={2}
          maxLength={500}
          disabled={saving}
        />

        <div className="new-function-dialog__detect">
          <button
            type="button"
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
            onClick={runDetect}
            disabled={saving}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Detect from business
          </button>
          <p className="new-function-dialog__hint">
            Suggests common functions from your industry and description.
          </p>
        </div>

        {chips.length > 0 ? (
          <div className="new-function-dialog__chips" role="list">
            {chips.slice(0, 8).map((chip) => (
              <button
                key={chip}
                type="button"
                role="listitem"
                className={`new-function-dialog__chip${
                  name.trim().toLowerCase() === chip.toLowerCase() ? " is-selected" : ""
                }`}
                onClick={() => setName(chip)}
                disabled={saving}
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="new-function-dialog__error">{error}</p> : null}

        <div className="new-function-dialog__actions">
          <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-sm" disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Add to map"
            )}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
