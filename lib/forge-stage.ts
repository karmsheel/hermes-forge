/**
 * Forge rooms (Phase 6 / BUSINESS_PLANT_PFD).
 * Baseline shipped as Map | Monitor | Automate “stages”; target IA is rooms with
 * Foundation as a first-class room and soft progressive unlock.
 *
 * Code still uses ForgeStage as the type id; user-facing copy should say “room”.
 */

export type ForgeStage = "foundation" | "map" | "monitor" | "automate";

/** @deprecated Prefer “room” in UI; alias kept for call sites mid-migration. */
export type ForgeRoom = ForgeStage;

export const FORGE_STAGES: readonly ForgeStage[] = [
  "foundation",
  "map",
  "monitor",
  "automate",
] as const;

export const FORGE_ROOMS = FORGE_STAGES;

export const FORGE_STAGE_LABELS: Record<ForgeStage, string> = {
  foundation: "Foundation",
  map: "Map",
  monitor: "Monitor",
  automate: "Automate",
};

export const FORGE_STAGE_DESCRIPTIONS: Record<ForgeStage, string> = {
  foundation: "Talk with Underlord — plant sketch, drafts, and documents",
  map: "See the business as a plant; open processes in Workshop",
  monitor: "Track metrics and content health (unlocks after a forged process)",
  automate: "Assign agents and run jobs (unlocks after a forged process)",
};

/**
 * Soft-lock copy when a room is not ready yet.
 * Locked rooms are hidden from the center room switcher; these strings still
 * power SoftRoomLock empty states if the user deep-links into a locked room.
 */
export const FORGE_ROOM_LOCK_HINTS: Record<ForgeStage, string | null> = {
  foundation: null,
  map: "Seed at least one process in Foundation to fill the plant map.",
  monitor: "Forge a process in Map / Workshop to open Monitor.",
  automate: "Forge a process in Map / Workshop to open Automate.",
};

/**
 * Room-scoped nav item ids (see NavRail main section).
 * Holistic items (log, decisions) live in the rail footer and are always shown.
 * Workshop is a Map tool (nav under Map), not a peer room.
 */
export const STAGE_NAV_IDS: Record<ForgeStage, readonly string[]> = {
  foundation: ["home", "foundation", "documents", "personnel"],
  map: ["functions", "workshop", "god-mode", "documents", "personnel"],
  monitor: ["metrics", "content", "cronalytics"],
  automate: ["automations", "automation-analysis", "personnel", "content"],
};

/** Nav ids always available regardless of room (footer of NavRail). */
export const HOLISTIC_NAV_IDS = ["decisions", "log"] as const;

const STORAGE_PREFIX = "forge:stage:";

export function isForgeStage(value: string | null | undefined): value is ForgeStage {
  return (
    value === "foundation" ||
    value === "map" ||
    value === "monitor" ||
    value === "automate"
  );
}

export const isForgeRoom = isForgeStage;

export function stageStorageKey(businessId: string): string {
  return `${STORAGE_PREFIX}${businessId}`;
}

export function readStoredStage(businessId: string | null | undefined): ForgeStage | null {
  if (!businessId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(stageStorageKey(businessId));
    return isForgeStage(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredStage(businessId: string, stage: ForgeStage): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(stageStorageKey(businessId), stage);
  } catch {
    /* ignore quota */
  }
}

/**
 * Infer room from pathname so deep links land in the right mode.
 * Returns null for routes that are room-neutral (settings, profile, business-manager).
 */
export function stageFromPath(pathname: string): ForgeStage | null {
  const path = pathname.split("?")[0] || "/";

  if (path.startsWith("/foundation")) {
    return "foundation";
  }

  if (
    path.startsWith("/workshop") ||
    path.startsWith("/functions") ||
    path.startsWith("/god-mode") ||
    path.startsWith("/documents") ||
    path.startsWith("/personnel")
  ) {
    // personnel appears in Foundation + Map + Automate; hire/academy lean Automate
    if (path.startsWith("/personnel") && path.includes("hire")) return "automate";
    if (path.startsWith("/personnel") && path.includes("academy")) return "automate";
    // documents shared Foundation + Map — prefer foundation for thin entry paths
    if (path.startsWith("/documents")) return null;
    if (path.startsWith("/personnel")) return null;
    return "map";
  }

  if (path.startsWith("/metrics") || path.startsWith("/cronalytics")) {
    return "monitor";
  }

  if (path.startsWith("/content")) {
    // Content lives in Monitor + Automate; keep stored room if set
    return null;
  }

  if (path.startsWith("/automations") || path.startsWith("/automation-analysis")) {
    return "automate";
  }

  // Room-neutral: available in every room
  if (path === "/home" || path === "/log" || path.startsWith("/decisions")) {
    return null;
  }

  return null;
}

export function defaultStageForPath(pathname: string): ForgeStage {
  return stageFromPath(pathname) ?? "foundation";
}

export function isNavIdInStage(navId: string, stage: ForgeStage): boolean {
  return STAGE_NAV_IDS[stage].includes(navId);
}

/** Default landing route when switching into a room. */
export const STAGE_DEFAULT_ROUTES: Record<ForgeStage, string> = {
  foundation: "/foundation",
  map: "/god-mode",
  monitor: "/metrics",
  automate: "/automations",
};

/** Whether the current path is a primary page for the given room. */
export function pathBelongsToStage(pathname: string, stage: ForgeStage): boolean {
  const path = pathname.split("?")[0] || "/";
  const inferred = stageFromPath(path);
  if (inferred) return inferred === stage;
  // Neutral routes (home, log, decisions) are valid in every room
  if (path === "/home" || path === "/log" || path.startsWith("/decisions")) return true;
  if (path.startsWith("/content")) return stage === "monitor" || stage === "automate";
  if (path.startsWith("/documents")) return stage === "foundation" || stage === "map";
  if (path.startsWith("/personnel") && !path.includes("hire") && !path.includes("academy")) {
    return stage === "foundation" || stage === "map" || stage === "automate";
  }
  return true;
}
