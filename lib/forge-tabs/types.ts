/** Desktop multi-tab shell types (4.15). Web ignores tabs entirely. */

export type WorkspacePanelTab = "diagram" | "details" | "questions" | "source" | "export";

export type ForgeTab = {
  id: string;
  /** Display label, e.g. "Acme Corp · Workshop" */
  title: string;
  /** Shell route, e.g. "/workshop", "/functions", "/automations/xyz" */
  route: string;
  businessId: string;
  businessName: string;
  /** Business avatar emoji (takes preference over icon / initial in the tab strip). */
  avatarEmoji?: string | null;
  /** Business avatar Lucide icon key (used when emoji is not set). */
  avatarIcon?: string | null;
  processId?: string;
  /** In-workshop panel (diagram, details, …) — not the app tab */
  workspaceTab?: WorkspacePanelTab;
  automationProcessId?: string;
};

export type ForgeTabsState = {
  version: 1;
  tabs: ForgeTab[];
  activeTabId: string;
};

/** Hard cap on open tabs (UI blocks new tabs beyond this). */
export const FORGE_TABS_MAX = 8;

/**
 * Soft cap on *mounted* workshop sessions. Beyond this, inactive workshop
 * sessions are unloaded (remount on activate) to free memory (Phase 3).
 */
export const FORGE_WORKSHOP_SOFT_MAX = 4;

export const FORGE_TABS_STORAGE_KEY = "forge-tabs:v1";

export function createTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Human label for a shell route used in tab titles. */
export function routePageLabel(route: string): string {
  const path = (route.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (path === "/home" || path === "/") return "Home";
  if (path.startsWith("/workshop")) return "Workshop";
  if (path.startsWith("/functions")) return "Functions";
  if (path.startsWith("/personnel")) return "Personnel";
  if (path.startsWith("/documents")) return "Documents";
  if (path.startsWith("/content")) return "Content";
  if (path.startsWith("/metrics")) return "Metrics";
  if (path.startsWith("/automation-analysis")) return "Automation Analysis";
  if (path.startsWith("/automations/")) return "Automation";
  if (path.startsWith("/automations")) return "Automations";
  if (path.startsWith("/log")) return "Business log";
  if (path.startsWith("/god-mode")) return "God Mode";
  if (path.startsWith("/decisions")) return "Decisions";
  if (path.startsWith("/cronalytics")) return "Cronalytics";
  if (path.startsWith("/business-manager")) return "Businesses";
  if (path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/settings")) return "Settings";
  const segment = path.split("/").filter(Boolean)[0];
  if (!segment) return "Home";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function formatTabTitle(
  businessName: string,
  route: string,
  processName?: string | null,
): string {
  const biz = businessName.trim() || "Business";
  if (processName?.trim()) {
    return `${biz} · ${processName.trim()}`;
  }
  return `${biz} · ${routePageLabel(route)}`;
}

export function buildTab(input: {
  id?: string;
  route: string;
  businessId: string;
  businessName: string;
  avatarEmoji?: string | null;
  avatarIcon?: string | null;
  processId?: string;
  processName?: string | null;
  workspaceTab?: WorkspacePanelTab;
  automationProcessId?: string;
  title?: string;
}): ForgeTab {
  const route = normalizeShellRoute(input.route);
  return {
    id: input.id ?? createTabId(),
    title:
      input.title ??
      formatTabTitle(input.businessName, route, input.processName),
    route,
    businessId: input.businessId,
    businessName: input.businessName,
    avatarEmoji: input.avatarEmoji ?? null,
    avatarIcon: input.avatarIcon ?? null,
    processId: input.processId,
    workspaceTab: input.workspaceTab,
    automationProcessId: input.automationProcessId,
  };
}

export function normalizeShellRoute(route: string): string {
  const raw = route.trim() || "/home";
  const pathOnly = raw.startsWith("/") ? raw : `/${raw}`;
  const [path, query] = pathOnly.split("?");
  const cleaned = (path || "/home").replace(/\/+$/, "") || "/home";
  // Keep known shell roots; map bare "/" to home
  const normalized = cleaned === "/" ? "/home" : cleaned;
  return query ? `${normalized}?${query}` : normalized;
}

export function isValidForgeTab(value: unknown): value is ForgeTab {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    t.id.length > 0 &&
    typeof t.title === "string" &&
    typeof t.route === "string" &&
    typeof t.businessId === "string" &&
    t.businessId.length > 0 &&
    typeof t.businessName === "string"
  );
}
