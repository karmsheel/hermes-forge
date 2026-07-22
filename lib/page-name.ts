import { ROOM_HOME_ROUTES } from "@/lib/forge-stage";
import { ROOM_HOME_COPY } from "@/lib/room-home";

/** Routes that never show the under-picker shell page name. */
const EXCLUDED_PREFIXES = ["/business-manager", "/setup", "/login", "/sign-in", "/signup"] as const;

/** Segment-safe prefix match: exact path or path under prefix/. */
function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Canonical page name for shell chrome (under business picker).
 * Returns null when the route has no AppTopBar page-name slot.
 */
export function pageNameFromPath(pathname: string): string | null {
  const raw = (pathname || "/").split("?")[0] || "/";
  const path = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;

  for (const prefix of EXCLUDED_PREFIXES) {
    if (matchesPrefix(path, prefix)) return null;
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

  // Longer prefixes first so e.g. /automation-analysis beats /automations
  const prefixRules: { prefix: string; name: string }[] = [
    { prefix: "/foundation", name: "Foundation" },
    { prefix: "/god-mode", name: "Plant" },
    { prefix: "/functions", name: "Functions" },
    { prefix: "/workshop", name: "Workshop" },
    { prefix: "/personnel", name: "Personnel" },
    { prefix: "/documents", name: "Documents" },
    { prefix: "/sessions", name: "Sessions" },
    { prefix: "/metrics", name: "Metrics" },
    { prefix: "/content", name: "Content" },
    { prefix: "/automation-analysis", name: "Automation Analysis" },
    { prefix: "/automations", name: "Automations" },
    { prefix: "/cronalytics", name: "Cronalytics" },
    { prefix: "/decisions", name: "Decisions" },
    { prefix: "/log", name: "Business log" },
  ];

  for (const rule of prefixRules) {
    if (matchesPrefix(path, rule.prefix)) return rule.name;
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
