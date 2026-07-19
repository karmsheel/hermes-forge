"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";
import type { FoundationOverview, FoundationProcessCard } from "@/lib/foundation";
import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@/lib/process-status";

/**
 * Read-only plant sketch: simple process blocks in a square frame.
 * Interaction is select / deselect only (no drag, link, rename, or open).
 */
export function PlantMiniView() {
  const { currentBusiness } = useShell();
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<FoundationProcessCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/foundation");
      if (!res.ok) {
        setProcesses([]);
        return;
      }
      const data = (await res.json()) as FoundationOverview;
      setProcesses(data.processes ?? []);
      setSelectedId((prev) => {
        if (prev && data.processes.some((p) => p.id === prev)) return prev;
        return null;
      });
    } catch {
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  function handleFrameClick(e: MouseEvent<HTMLDivElement>) {
    // Click empty frame / padding deselects
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    }
  }

  function handleBlockClick(e: MouseEvent, id: string) {
    e.stopPropagation();
    setSelectedId(id);
  }

  return (
    <div className="plant-mini">
      <div className="plant-mini__header">
        <h2 className="plant-mini__title">Plant</h2>
        <p className="plant-mini__meta">
          {loading
            ? "Loading…"
            : processes.length === 0
              ? "No processes yet"
              : `${processes.length} process${processes.length === 1 ? "" : "es"}`}
        </p>
      </div>

      <div
        className="plant-mini__frame"
        role="listbox"
        aria-label="Plant processes"
        aria-activedescendant={selectedId ? `plant-mini-block-${selectedId}` : undefined}
        onClick={handleFrameClick}
      >
        {loading ? (
          <div className="plant-mini__empty" aria-busy="true">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            <span>Loading plant…</span>
          </div>
        ) : processes.length === 0 ? (
          <div className="plant-mini__empty">
            <p>Seed a process from the composer — blocks will appear here.</p>
          </div>
        ) : (
          <div
            className="plant-mini__grid"
            onClick={(e) => {
              // Empty grid padding deselects (blocks stopPropagation)
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            {processes.map((proc) => (
              <PlantMiniBlock
                key={proc.id}
                process={proc}
                selected={proc.id === selectedId}
                onSelect={(e) => handleBlockClick(e, proc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlantMiniBlock({
  process,
  selected,
  onSelect,
}: {
  process: FoundationProcessCard;
  selected: boolean;
  onSelect: (e: MouseEvent) => void;
}) {
  const statusLabel =
    PROCESS_STATUS_LABELS[process.status as ProcessStatus] ?? process.status;

  return (
    <button
      type="button"
      id={`plant-mini-block-${process.id}`}
      role="option"
      aria-selected={selected}
      className={`plant-mini__block${selected ? " plant-mini__block--selected" : ""}`}
      onClick={onSelect}
      title={process.name}
    >
      <span className="plant-mini__block-icon" aria-hidden>
        <IoShapeGlyph shape={process.ioShape} size="sm" title={false} />
      </span>
      <span className="plant-mini__block-name">{process.name}</span>
      <span className="plant-mini__block-status">{statusLabel}</span>
    </button>
  );
}
