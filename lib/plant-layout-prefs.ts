/**
 * Client persistence for plant layout mode + manual tile positions (6.6).
 * Per-business localStorage — no schema migration required for v1.
 */

import {
  isPlantLayoutMode,
  type PlantLayoutMode,
  type PlantManualPositions,
} from "@/lib/plant-layout";

const MODE_PREFIX = "forge:plant-layout-mode:";
const POS_PREFIX = "forge:plant-positions:";

export function plantLayoutModeKey(businessId: string): string {
  return `${MODE_PREFIX}${businessId}`;
}

export function plantPositionsKey(businessId: string): string {
  return `${POS_PREFIX}${businessId}`;
}

export function loadPlantLayoutMode(
  businessId: string | null | undefined,
): PlantLayoutMode {
  if (!businessId || typeof window === "undefined") return "function";
  try {
    const raw = localStorage.getItem(plantLayoutModeKey(businessId));
    return isPlantLayoutMode(raw) ? raw : "function";
  } catch {
    return "function";
  }
}

export function savePlantLayoutMode(
  businessId: string | null | undefined,
  mode: PlantLayoutMode,
): void {
  if (!businessId || typeof window === "undefined") return;
  try {
    localStorage.setItem(plantLayoutModeKey(businessId), mode);
  } catch {
    /* ignore */
  }
}

export function loadPlantPositions(
  businessId: string | null | undefined,
): PlantManualPositions {
  if (!businessId || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(plantPositionsKey(businessId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PlantManualPositions = {};
    for (const [id, pos] of Object.entries(parsed as Record<string, unknown>)) {
      if (!pos || typeof pos !== "object") continue;
      const x = (pos as { x?: unknown }).x;
      const y = (pos as { y?: unknown }).y;
      if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
        out[id] = { x, y };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePlantPositions(
  businessId: string | null | undefined,
  positions: PlantManualPositions,
): void {
  if (!businessId || typeof window === "undefined") return;
  try {
    localStorage.setItem(plantPositionsKey(businessId), JSON.stringify(positions));
  } catch {
    /* ignore */
  }
}

export function upsertPlantPosition(
  businessId: string | null | undefined,
  processId: string,
  x: number,
  y: number,
): PlantManualPositions {
  const next = { ...loadPlantPositions(businessId), [processId]: { x, y } };
  savePlantPositions(businessId, next);
  return next;
}
