import {
  FORGE_TABS_STORAGE_KEY,
  isValidForgeTab,
  type ForgeTab,
  type ForgeTabsState,
} from "./types";

export type ForgeTabsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

function defaultStorage(): ForgeTabsStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadForgeTabsState(
  storage: ForgeTabsStorage | null = defaultStorage(),
): ForgeTabsState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FORGE_TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ForgeTabsState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.tabs)) return null;
    const tabs = parsed.tabs.filter(isValidForgeTab);
    if (tabs.length === 0) return null;
    const activeTabId =
      typeof parsed.activeTabId === "string" &&
      tabs.some((t) => t.id === parsed.activeTabId)
        ? parsed.activeTabId
        : tabs[0]!.id;
    return { version: 1, tabs, activeTabId };
  } catch {
    return null;
  }
}

export function saveForgeTabsState(
  state: { tabs: ForgeTab[]; activeTabId: string },
  storage: ForgeTabsStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const payload: ForgeTabsState = {
      version: 1,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    };
    storage.setItem(FORGE_TABS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function clearForgeTabsState(
  storage: ForgeTabsStorage | null = defaultStorage(),
): void {
  if (!storage?.removeItem) return;
  try {
    storage.removeItem(FORGE_TABS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
