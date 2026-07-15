/**
 * God Mode canvas view mode (Phase 6.4).
 * Compact = uniform I/O-shape plant cards; diagrams = full Mermaid tiles (4.13).
 */

export type GodModeViewMode = "compact" | "diagrams";

export const GOD_MODE_VIEW_STORAGE_KEY = "forge:god-mode-view";

export function isGodModeViewMode(value: unknown): value is GodModeViewMode {
  return value === "compact" || value === "diagrams";
}

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
