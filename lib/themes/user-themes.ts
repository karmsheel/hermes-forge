import { forgeVarsFromSkin } from "./apply-skin";
import { BUILTIN_SKINS } from "./presets";
import { parseThemeInput } from "./validate";
import type { ForgeSkin, ForgeSkinVars } from "./types";

export const USER_THEMES_STORAGE_KEY = "hermes-forge-user-themes-v1";

export interface UserThemeEntry {
  theme: ForgeSkin;
  bootVars: { light: ForgeSkinVars; dark: ForgeSkinVars };
}

export type UserThemeStore = Record<string, UserThemeEntry>;

function readStore(): UserThemeStore {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(USER_THEMES_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const out: UserThemeStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (BUILTIN_SKINS[key]) continue;
      if (!value || typeof value !== "object") continue;
      const entry = value as Partial<UserThemeEntry>;
      if (!entry.theme || !entry.bootVars) continue;
      if (typeof entry.theme.name !== "string" || entry.theme.name !== key) continue;
      out[key] = entry as UserThemeEntry;
    }
    return out;
  } catch {
    return {};
  }
}

function persistStore(store: UserThemeStore): void {
  try {
    window.localStorage.setItem(USER_THEMES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* best-effort */
  }
}

function buildEntry(theme: ForgeSkin): UserThemeEntry {
  return {
    theme,
    bootVars: {
      light: forgeVarsFromSkin(theme, "light"),
      dark: forgeVarsFromSkin(theme, "dark"),
    },
  };
}

/** All installed user themes keyed by slug. */
export function getUserThemes(): UserThemeStore {
  return readStore();
}

export function getUserThemeNames(): string[] {
  return Object.keys(readStore());
}

export function isUserSkinName(name: string): boolean {
  return Boolean(readStore()[name]);
}

export function listUserSkins(): ForgeSkin[] {
  return Object.values(readStore()).map((entry) => entry.theme);
}

/** Install (or replace) a user theme. Returns the stored theme. */
export function installUserTheme(theme: ForgeSkin): ForgeSkin {
  if (BUILTIN_SKINS[theme.name]) {
    throw new Error(`"${theme.name}" collides with a built-in skin.`);
  }

  const store = readStore();
  store[theme.name] = buildEntry(theme);
  persistStore(store);
  return theme;
}

/** Parse JSON and install. Throws with a human-readable message on failure. */
export function installUserThemeFromJson(input: string): ForgeSkin {
  const result = parseThemeInput(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return installUserTheme(result.theme);
}

/** Remove a user theme by slug. No-op for unknown or built-in names. */
export function removeUserTheme(name: string): void {
  const store = readStore();
  if (!store[name]) return;

  const next = { ...store };
  delete next[name];
  persistStore(next);
}