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

/** Whether the room is soft-unlocked (full product surface expected). */
export function isRoomSoftUnlocked(
  room: ForgeStage,
  readiness: RoomReadiness | null | undefined,
): boolean {
  if (!readiness) {
    // Unknown yet — treat Foundation open, others unlocked optimistically until stats load
    return room === "foundation" || room === "map";
  }
  switch (room) {
    case "foundation":
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
