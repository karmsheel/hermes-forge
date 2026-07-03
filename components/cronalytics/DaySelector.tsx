"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cronalytics:days";
const DEFAULT = 30;

const OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "24h" },
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 0, label: "All" },
];

export function DaySelector({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  // Hydrate from localStorage on mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-1 text-xs">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(STORAGE_KEY, String(opt.value));
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

DaySelector.defaultDays = DEFAULT;
