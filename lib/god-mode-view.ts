/**
 * God Mode / Map plant view mode (Phase 6.4; demoted Mermaid tiles in 8.7).
 * Compact = uniform I/O-shape plant cards (product default).
 * Diagrams = full Mermaid tiles — **legacy only** (not process depth SoT).
 */

import {
  MERMAID_TILES_LABEL,
  MERMAID_TILES_TITLE,
} from "@/lib/mermaid-policy";

export type GodModeViewMode = "compact" | "diagrams";

export const GOD_MODE_VIEW_STORAGE_KEY = "forge:god-mode-view";

/** Re-export for plant chrome (Phase 8.7 demote). */
export { MERMAID_TILES_LABEL, MERMAID_TILES_TITLE };

export function isGodModeViewMode(value: unknown): value is GodModeViewMode {
  return value === "compact" || value === "diagrams";
}

/**
 * Load plant view mode. Defaults to compact; stored "diagrams" is still
 * honored so power users keep preference, but chrome labels it as legacy.
 */
export function loadGodModeViewMode(): GodModeViewMode {
  if (typeof window === "undefined") return "compact";
  try {
    const raw = localStorage.getItem(GOD_MODE_VIEW_STORAGE_KEY);
    return isGodModeViewMode(raw) ? raw : "compact";
  } catch {
    return "compact";
  }
}

export function saveGodModeViewMode(mode: GodModeViewMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOD_MODE_VIEW_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Fixed compact plant card size (px). */
export const COMPACT_TILE = {
  width: 176,
  height: 168,
  gap: 20,
  rowMaxWidth: 1600,
} as const;
