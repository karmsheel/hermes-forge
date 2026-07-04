import { ACCENT_STORAGE_KEY, type AccentId } from "@/lib/accent";
import { DEFAULT_SKIN_NAME, isBuiltinSkinName } from "./presets";

export const SKIN_STORAGE_KEY = "hermes-forge-skin";
const MIGRATION_FLAG_KEY = "hermes-forge-skin-migrated-v1";

/** Map legacy accent ids to closest built-in skin. */
const ACCENT_TO_SKIN: Record<AccentId, string> = {
  terracotta: "forge",
  coral: "ember",
  amber: "ember",
  sage: "slate",
  ocean: "nous",
  plum: "midnight",
  rose: "midnight",
  slate: "slate",
};

export function getStoredSkinName(): string {
  if (typeof window === "undefined") return DEFAULT_SKIN_NAME;

  try {
    migrateAccentToSkinIfNeeded();

    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored && isBuiltinSkinName(stored)) return stored;
  } catch {
    /* ignore */
  }

  return DEFAULT_SKIN_NAME;
}

function migrateAccentToSkinIfNeeded(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;

    const existingSkin = localStorage.getItem(SKIN_STORAGE_KEY);
    if (!existingSkin) {
      const legacyAccent = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentId | null;
      const mapped =
        legacyAccent && legacyAccent in ACCENT_TO_SKIN
          ? ACCENT_TO_SKIN[legacyAccent]
          : DEFAULT_SKIN_NAME;
      localStorage.setItem(SKIN_STORAGE_KEY, mapped);
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    localStorage.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function persistSkinName(name: string): void {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}