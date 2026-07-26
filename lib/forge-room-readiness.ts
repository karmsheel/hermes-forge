/**
 * Soft progressive unlock for Forge rooms (BUSINESS_PLANT_PFD + Phase 8.6).
 * Pure helpers — no I/O.
 *
 * Map readiness (8.6 rule):
 *   Soft-unlock when the business graph has ≥1 unit, capability, or process node,
 *   OR (legacy fallback) ≥1 Prisma Process row exists (pre-graph / mid-seed).
 * Monitor / Automate stay on ≥1 forged process until 8.10 / 8.11.
 */

import type { ForgeStage } from "@/lib/forge-stage";
import { FORGE_ROOM_LOCK_HINTS } from "@/lib/forge-stage";

export type RoomReadinessStats = {
  /** Legacy Prisma Process row count for the active business. */
  processCount: number;
  forgedCount: number;
  /** Graph unit nodes (optional; 0 when unknown). */
  unitCount?: number;
  /** Graph capability nodes. */
  capabilityCount?: number;
  /** Graph process-kind nodes (not the same as processCount). */
  graphProcessCount?: number;
};

export type RoomReadiness = {
  processCount: number;
  forgedCount: number;
  unitCount: number;
  capabilityCount: number;
  graphProcessCount: number;
  /**
   * Map has graph structure (unit|capability|process) or legacy process rows.
   * Soft: room still deep-linkable when false (SoftRoomLock).
   */
  mapReady: boolean;
  /** Monitor + Automate unlock on ≥1 forged process. */
  operateReady: boolean;
};

/**
 * Whether Map should soft-unlock from stats.
 * Primary: graph structural nodes. Fallback: legacy process rows.
 */
export function isMapReadyFromStats(stats: {
  processCount: number;
  unitCount?: number;
  capabilityCount?: number;
  graphProcessCount?: number;
}): boolean {
  const units = Math.max(0, stats.unitCount ?? 0);
  const caps = Math.max(0, stats.capabilityCount ?? 0);
  const graphProcesses = Math.max(0, stats.graphProcessCount ?? 0);
  const structural = units + caps + graphProcesses;
  if (structural >= 1) return true;
  return Math.max(0, stats.processCount | 0) >= 1;
}

export function computeRoomReadiness(stats: RoomReadinessStats): RoomReadiness {
  const processCount = Math.max(0, stats.processCount | 0);
  const forgedCount = Math.max(0, stats.forgedCount | 0);
  const unitCount = Math.max(0, (stats.unitCount ?? 0) | 0);
  const capabilityCount = Math.max(0, (stats.capabilityCount ?? 0) | 0);
  const graphProcessCount = Math.max(0, (stats.graphProcessCount ?? 0) | 0);
  return {
    processCount,
    forgedCount,
    unitCount,
    capabilityCount,
    graphProcessCount,
    mapReady: isMapReadyFromStats({
      processCount,
      unitCount,
      capabilityCount,
      graphProcessCount,
    }),
    operateReady: forgedCount >= 1,
  };
}

/**
 * Whether the room is unlocked for chrome + full product surface.
 * While readiness is unknown (loading), only Foundation + Inventory are treated
 * as open so Map/Monitor/Automate do not flash in the room switcher before
 * stats arrive. Deep links to locked rooms still render SoftRoomLock empty states.
 */
export function isRoomSoftUnlocked(
  room: ForgeStage,
  readiness: RoomReadiness | null | undefined,
): boolean {
  if (!readiness) {
    return room === "foundation" || room === "inventory";
  }
  switch (room) {
    case "foundation":
    case "inventory":
      return true;
    case "map":
      return readiness.mapReady;
    case "monitor":
    case "automate":
      return readiness.operateReady;
    default:
      return true;
  }
}

export function roomLockHint(
  room: ForgeStage,
  readiness: RoomReadiness | null | undefined,
): string | null {
  if (isRoomSoftUnlocked(room, readiness)) return null;
  return FORGE_ROOM_LOCK_HINTS[room];
}

/** Suggested default room for a business given readiness. */
export function preferredRoomForReadiness(
  readiness: RoomReadiness | null | undefined,
): ForgeStage {
  if (!readiness) return "foundation";
  if (!readiness.mapReady) return "foundation";
  if (readiness.operateReady) return "map";
  return "map";
}
