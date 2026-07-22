// lib/page-name.ts
import { ROOM_HOME_ROUTES } from "@/lib/forge-stage";
import { ROOM_HOME_COPY } from "@/lib/room-home";

/** Routes that never show the under-picker shell page name. */
const EXCLUDED_PREFIXES = ["/business-manager", "/setup", "/login", "/sign-in", "/signup"] as const;

/**
 * Canonical page name for shell chrome (under business picker).
 * Returns null when the route has no AppTopBar page-name slot.
 */
export function pageNameFromPath(pathname: string): string | null {
  const raw = (pathname || "/").split("?")[0] || "/";
  const path = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;

  for (const prefix of EXCLUDED_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return null;
  }

  // Room homes — use roomBadge from ROOM_HOME_COPY
  if (path === "/" || path === ROOM_HOME_ROUTES.foundation) {
    return ROOM_HOME_COPY.foundation.roomBadge;
  }
  if (path === ROOM_HOME_ROUTES.inventory) return ROOM_HOME_COPY.inventory.roomBadge;
  if (path === ROOM_HOME_ROUTES.map) return ROOM_HOME_COPY.map.roomBadge;
  if (path === ROOM_HOME_ROUTES.monitor) return ROOM_HOME_COPY.monitor.roomBadge;
  if (path === ROOM_HOME_ROUTES.automate) return ROOM_HOME_COPY.automate.roomBadge;

  if (path === "/home-combined") return "Home Combined";

  const prefixRules: { test: (p: string) => boolean; name: string }[] = [
    { test: (p) => p.startsWith("/foundation"), name: "Foundation" },
    { test: (p) => p.startsWith("/god-mode"), name: "Plant" },
    { test: (p) => p === "/functions" || p.startsWith("/functions/"), name: "Functions" },
    { test: (p) => p.startsWith("/workshop"), name: "Workshop" },
    { test: (p) => p.startsWith("/personnel"), name: "Personnel" },
    { test: (p) => p.startsWith("/documents"), name: "Documents" },
    { test: (p) => p.startsWith("/metrics"), name: "Metrics" },
    { test: (p) => p.startsWith("/content"), name: "Content" },
    { test: (p) => p.startsWith("/automations"), name: "Automations" },
    { test: (p) => p.startsWith("/automation-analysis"), name: "Automation Analysis" },
    { test: (p) => p.startsWith("/cronalytics"), name: "Cronalytics" },
    { test: (p) => p.startsWith("/decisions"), name: "Decisions" },
    { test: (p) => p.startsWith("/log"), name: "Business log" },
  ];

  for (const rule of prefixRules) {
    if (rule.test(path)) return rule.name;
  }

  // Fallback: first segment → readable label
  const seg = path.replace(/^\//, "").split("/")[0];
  if (!seg) return null;
  return seg
    .split("-")
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
