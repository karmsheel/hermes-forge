/**
 * Map | Monitor | Automate stage model (Phase 5 / M0).
 * Client-persisted per business; deep links auto-select stage from route.
 */

export type ForgeStage = "map" | "monitor" | "automate";

export const FORGE_STAGES: readonly ForgeStage[] = ["map", "monitor", "automate"] as const;

export const FORGE_STAGE_LABELS: Record<ForgeStage, string> = {
  map: "Map",
  monitor: "Monitor",
  automate: "Automate",
};

export const FORGE_STAGE_DESCRIPTIONS: Record<ForgeStage, string> = {
  map: "Understand how the business works",
  monitor: "Track metrics and content health",
  automate: "Assign agents and run jobs",
};

/**
 * Stage-scoped nav item ids (see NavRail main section).
 * Holistic items (log, decisions) live in the rail footer and are always shown.
 */
export const STAGE_NAV_IDS: Record<ForgeStage, readonly string[]> = {
  map: ["home", "functions", "workshop", "personnel", "documents", "god-mode"],
  monitor: ["home", "metrics", "content", "cronalytics"],
  automate: ["home", "automations", "automation-analysis", "personnel", "content"],
};

/** Nav ids always available regardless of stage (footer of NavRail). */
export const HOLISTIC_NAV_IDS = ["decisions", "log"] as const;

const STORAGE_PREFIX = "forge:stage:";

export function isForgeStage(value: string | null | undefined): value is ForgeStage {
  return value === "map" || value === "monitor" || value === "automate";
}

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
 * Infer stage from pathname so deep links land in the right mode.
 * Returns null for routes that are stage-neutral (settings, profile, business-manager).
 */
export function stageFromPath(pathname: string): ForgeStage | null {
  const path = pathname.split("?")[0] || "/";

  if (
    path.startsWith("/workshop") ||
    path.startsWith("/functions") ||
    path.startsWith("/documents") ||
    path.startsWith("/god-mode") ||
    path.startsWith("/personnel")
  ) {
    // personnel appears in Map + Automate; prefer map for hire/academy discovery paths
    if (path.startsWith("/personnel") && path.includes("hire")) return "automate";
    if (path.startsWith("/personnel") && path.includes("academy")) return "automate";
    return "map";
  }

  if (path.startsWith("/metrics") || path.startsWith("/cronalytics")) {
    return "monitor";
  }

  if (path.startsWith("/content")) {
    // Content lives in Monitor + Automate; keep stored stage if set
    return null;
  }

  if (path.startsWith("/automations") || path.startsWith("/automation-analysis")) {
    return "automate";
  }

  // Stage-neutral: available in Map, Monitor, and Automate
  if (path === "/home" || path === "/log" || path.startsWith("/decisions")) {
    return null;
  }

  return null;
}

export function defaultStageForPath(pathname: string): ForgeStage {
  return stageFromPath(pathname) ?? "map";
}

export function isNavIdInStage(navId: string, stage: ForgeStage): boolean {
  return STAGE_NAV_IDS[stage].includes(navId);
}

/** Default landing route when switching into a stage. */
export const STAGE_DEFAULT_ROUTES: Record<ForgeStage, string> = {
  map: "/functions",
  monitor: "/metrics",
  automate: "/automations",
};

/** Whether the current path is a primary page for the given stage. */
export function pathBelongsToStage(pathname: string, stage: ForgeStage): boolean {
  const path = pathname.split("?")[0] || "/";
  const inferred = stageFromPath(path);
  if (inferred) return inferred === stage;
  // Neutral routes (home, log, decisions) are valid in every stage
  if (path === "/home" || path === "/log" || path.startsWith("/decisions")) return true;
  if (path.startsWith("/content")) return stage === "monitor" || stage === "automate";
  return true;
}
