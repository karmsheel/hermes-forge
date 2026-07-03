"use client";

import { useEffect } from "react";
import type { ModeFilter } from "@/lib/cronalytics/types";

const STORAGE_KEY = "cronalytics:mode";
const OPTIONS: Array<{ value: ModeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "agent", label: "Agent" },
  { value: "no_agent", label: "No-agent" },
];

export function ModeToggle({ value, onChange }: { value: ModeFilter; onChange: (v: ModeFilter) => void }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "all" || raw === "agent" || raw === "no_agent") {
        if (raw !== value) onChange(raw as ModeFilter);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-text-soft mr-1">Mode</span>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(STORAGE_KEY, opt.value);
              } catch {
                /* ignore */
              }
              onChange(opt.value);
            }}
            className={`px-2.5 py-1 rounded-md border transition ${
              active
                ? "bg-accent/15 border-accent/40 text-text"
                : "bg-bg-muted/40 border-border text-text-muted hover:text-text hover:border-border/80"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
