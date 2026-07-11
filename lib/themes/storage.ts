import { DEFAULT_SKIN_NAME, isBuiltinSkinName } from "./presets";
import { isUserSkinName } from "./user-themes";

export const SKIN_STORAGE_KEY = "hermes-forge-skin";
const MIGRATION_FLAG_KEY = "hermes-forge-skin-migrated-v1";

/** Legacy accent storage key (pre-skin engine); migrated once then removed. */
const LEGACY_ACCENT_STORAGE_KEY = "hermes-forge-accent";

/** Map legacy accent ids to closest built-in skin. */
const LEGACY_ACCENT_TO_SKIN: Record<string, string> = {
  terracotta: "iron-ember",
  coral: "ember",
  amber: "ember",
  sage: "mono",
  ocean: "nous",
  plum: "midnight",
  rose: "midnight",
  slate: "mono",
};

export function getStoredSkinName(): string {
  if (typeof window === "undefined") return DEFAULT_SKIN_NAME;

  try {
    migrateAccentToSkinIfNeeded();

    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored && (isBuiltinSkinName(stored) || isUserSkinName(stored))) return stored;
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
      const legacyAccent = localStorage.getItem(LEGACY_ACCENT_STORAGE_KEY);
      const mapped =
        legacyAccent && legacyAccent in LEGACY_ACCENT_TO_SKIN
          ? LEGACY_ACCENT_TO_SKIN[legacyAccent]
          : DEFAULT_SKIN_NAME;
      localStorage.setItem(SKIN_STORAGE_KEY, mapped);
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    localStorage.removeItem(LEGACY_ACCENT_STORAGE_KEY);
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
