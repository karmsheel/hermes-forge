/**
 * Forge rooms (Phase 6 / BUSINESS_PLANT_PFD).
 * Baseline shipped as Map | Monitor | Automate “stages”; target IA is rooms with
 * Foundation as a first-class room and soft progressive unlock.
 *
 * Code still uses ForgeStage as the type id; user-facing copy should say “room”.
 */

export type ForgeStage =
  | "foundation"
  | "inventory"
  | "map"
  | "monitor"
  | "automate";

/** @deprecated Prefer “room” in UI; alias kept for call sites mid-migration. */
export type ForgeRoom = ForgeStage;

export const FORGE_STAGES: readonly ForgeStage[] = [
  "foundation",
  "inventory",
  "map",
  "monitor",
  "automate",
] as const;

export const FORGE_ROOMS = FORGE_STAGES;

/** Rooms next to the business picker (always available; multi-tab like MMA). */
export const LEADING_ROOMS: readonly ForgeStage[] = [
  "foundation",
  "inventory",
] as const;

/** Operating rooms in the center cluster (soft progressive unlock). */
export const OPS_ROOMS: readonly ForgeStage[] = [
  "map",
  "monitor",
  "automate",
] as const;

export const FORGE_STAGE_LABELS: Record<ForgeStage, string> = {
  foundation: "Foundation",
  inventory: "Inventory",
  map: "Map",
  monitor: "Monitor",
  automate: "Automate",
};

export const FORGE_STAGE_DESCRIPTIONS: Record<ForgeStage, string> = {
  foundation: "Talk with Overlord — plant sketch, drafts, and documents",
  inventory: "Digital assets and objects the business uses or ships",
  map: "See the business as a plant; open processes in Workshop",
  monitor: "Track metrics and health of forged work (unlocks after a forged process)",
  automate: "Assign agents and run jobs (unlocks after a forged process)",
};

/**
 * Soft-lock copy when a room is not ready yet.
 * Locked rooms are hidden from the center room switcher; these strings still
 * power SoftRoomLock empty states if the user deep-links into a locked room.
 */
export const FORGE_ROOM_LOCK_HINTS: Record<ForgeStage, string | null> = {
  foundation: null,
  inventory: null,
  map: "Seed at least one process in Foundation to fill the plant map.",
  monitor: "Forge a process in Map / Workshop to open Monitor.",
  automate: "Forge a process in Map / Workshop to open Automate.",
};

/**
 * Room-scoped nav item ids (see NavRail main section).
 * Holistic items (log, decisions) live in the rail footer and are always shown.
 * Workshop is a Map tool (nav under Map), not a peer room.
 * Each room has its own Home at the top of the rail (room homes — deferred 6.7 polish).
 */
export const STAGE_NAV_IDS: Record<ForgeStage, readonly string[]> = {
  foundation: ["home", "home-combined", "foundation", "documents", "personnel"],
  inventory: ["home", "content"],
  map: ["home", "god-mode", "functions", "workshop", "documents", "personnel"],
  monitor: ["home", "metrics", "cronalytics"],
  automate: ["home", "automations", "automation-analysis", "personnel"],
};

/** Per-room Home routes (left-rail Home + room-switch landing). */
export const ROOM_HOME_ROUTES: Record<ForgeStage, string> = {
  foundation: "/home",
  inventory: "/inventory/home",
  map: "/map/home",
  monitor: "/monitor/home",
  automate: "/automate/home",
};

export function isRoomHomePath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return (
    path === "/home" ||
    path === "/" ||
    path === "/inventory/home" ||
    path === "/map/home" ||
    path === "/monitor/home" ||
    path === "/automate/home"
  );
}

export function roomHomeForStage(stage: ForgeStage): string {
  return ROOM_HOME_ROUTES[stage];
}

/** Nav ids always available regardless of room (footer of NavRail). */
export const HOLISTIC_NAV_IDS = ["decisions", "log"] as const;

const STORAGE_PREFIX = "forge:stage:";

export function isForgeStage(value: string | null | undefined): value is ForgeStage {
  return (
    value === "foundation" ||
    value === "inventory" ||
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

  // Per-room homes (before broader /home and /automations prefixes)
  if (path === "/home" || path === "/") return "foundation";
  if (path === "/home-combined") return "foundation";
  if (path === "/inventory/home") return "inventory";
  if (path === "/map/home") return "map";
  if (path === "/monitor/home") return "monitor";
  if (path === "/automate/home") return "automate";

  if (path.startsWith("/foundation")) {
    return "foundation";
  }

  if (path.startsWith("/inventory") || path.startsWith("/content")) {
    return "inventory";
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

  if (path.startsWith("/automations") || path.startsWith("/automation-analysis")) {
    return "automate";
  }

  // Room-neutral: available in every room
  if (path === "/log" || path.startsWith("/decisions")) {
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

/** Default landing route when switching into a room (each room's Home). */
export const STAGE_DEFAULT_ROUTES: Record<ForgeStage, string> = {
  foundation: ROOM_HOME_ROUTES.foundation,
  inventory: ROOM_HOME_ROUTES.inventory,
  map: ROOM_HOME_ROUTES.map,
  monitor: ROOM_HOME_ROUTES.monitor,
  automate: ROOM_HOME_ROUTES.automate,
};

/** Whether the current path is a primary page for the given room. */
export function pathBelongsToStage(pathname: string, stage: ForgeStage): boolean {
  const path = pathname.split("?")[0] || "/";
  const inferred = stageFromPath(path);
  if (inferred) return inferred === stage;
  // Neutral routes (log, decisions) are valid in every room
  if (path === "/log" || path.startsWith("/decisions")) return true;
  if (path.startsWith("/documents")) return stage === "foundation" || stage === "map";
  if (path.startsWith("/personnel") && !path.includes("hire") && !path.includes("academy")) {
    return stage === "foundation" || stage === "map" || stage === "automate";
  }
  return true;
}
