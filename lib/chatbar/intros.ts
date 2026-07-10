/**
 * First-visit page intro tracking for the global chatbar (PR-3).
 * Keyed by businessId + routeKey so each business gets its own intro once.
 */

export const CHATBAR_INTROS_STORAGE_KEY = "forge.chatbar.introsSeen";

/** Map of `${businessId}::${routeKey}` → ISO date string */
export type IntrosSeenMap = Record<string, string>;

export function introKey(businessId: string, routeKey: string): string {
  return `${businessId}::${routeKey}`;
}

export function loadIntrosSeen(): IntrosSeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHATBAR_INTROS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: IntrosSeenMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveIntrosSeen(map: IntrosSeenMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHATBAR_INTROS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function hasSeenIntro(businessId: string, routeKey: string): boolean {
  if (!businessId || !routeKey) return true;
  const map = loadIntrosSeen();
  return Boolean(map[introKey(businessId, routeKey)]);
}

export function markIntroSeen(businessId: string, routeKey: string): void {
  if (!businessId || !routeKey) return;
  const map = loadIntrosSeen();
  map[introKey(businessId, routeKey)] = new Date().toISOString();
  saveIntrosSeen(map);
}

export function clearIntroSeen(businessId: string, routeKey: string): void {
  if (!businessId || !routeKey) return;
  const map = loadIntrosSeen();
  delete map[introKey(businessId, routeKey)];
  saveIntrosSeen(map);
}
