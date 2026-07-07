"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, FolderKanban } from "lucide-react";
import type { FunctionSummary } from "@/lib/functions";

interface FunctionFilterPickerProps {
  value: string | null;
  functions: FunctionSummary[];
  onChange: (functionName: string | null) => void;
}

export function FunctionFilterPicker({
  value,
  functions,
  onChange,
}: FunctionFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLabel = value ?? "All functions";

  useEffect(() => {
    if (!open) return;

    function onClickOutside(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectFunction(functionName: string | null) {
    onChange(functionName);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="w-full flex items-center gap-2 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-left text-sm transition-colors hover:border-border-strong hover:bg-bg-muted"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Filter by function: ${selectedLabel}`}
      >
        <FolderKanban className="w-3.5 h-3.5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-text">{selectedLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-text-soft transition-transform${open ? " rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          id={listId}
          className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-20 max-h-56 overflow-y-auto rounded-xl border border-border bg-bg-panel p-1 shadow-lg"
          role="listbox"
          aria-label="Function filter"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-bg-subtle${
                value === null ? " bg-bg-muted text-text-strong" : " text-text"
              }`}
              onClick={() => selectFunction(null)}
            >
              <span>All functions</span>
              {value === null ? <Check className="w-3.5 h-3.5 shrink-0 text-accent" /> : null}
            </button>
          </li>
          {functions.map((fn) => {
            const active = value === fn.name;
            return (
              <li key={fn.name} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-bg-subtle${
                    active ? " bg-bg-muted text-text-strong" : " text-text"
                  }`}
                  onClick={() => selectFunction(fn.name)}
                >
                  <span className="min-w-0 truncate">
                    {fn.name}
                    <span className="ml-1.5 text-xs text-text-soft">
                      ({fn.count})
                    </span>
                  </span>
                  {active ? <Check className="w-3.5 h-3.5 shrink-0 text-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}