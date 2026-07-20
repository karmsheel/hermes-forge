/**
 * Soft progressive unlock for Forge rooms (BUSINESS_PLANT_PFD).
 * Pure helpers — no I/O.
 */

import type { ForgeStage } from "@/lib/forge-stage";
import { FORGE_ROOM_LOCK_HINTS } from "@/lib/forge-stage";

export type RoomReadinessStats = {
  processCount: number;
  forgedCount: number;
};

export type RoomReadiness = {
  processCount: number;
  forgedCount: number;
  /** Map has something to show (soft: still openable when false). */
  mapReady: boolean;
  /** Monitor + Automate unlock on ≥1 forged process. */
  operateReady: boolean;
};

export function computeRoomReadiness(stats: RoomReadinessStats): RoomReadiness {
  const processCount = Math.max(0, stats.processCount | 0);
  const forgedCount = Math.max(0, stats.forgedCount | 0);
  return {
    processCount,
    forgedCount,
    mapReady: processCount >= 1,
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
