import { BUILTIN_SKIN_LIST, BUILTIN_SKINS, DEFAULT_SKIN_NAME } from "./presets";
import { getUserThemes, listUserSkins } from "./user-themes";
import type { ForgeSkin } from "./types";

export function resolveSkin(name: string | null | undefined): ForgeSkin {
  if (name) {
    if (BUILTIN_SKINS[name]) return BUILTIN_SKINS[name];
    const user = getUserThemes()[name];
    if (user) return user.theme;
  }
  return BUILTIN_SKINS[DEFAULT_SKIN_NAME];
}

export function listBuiltinSkins(): ForgeSkin[] {
  return BUILTIN_SKIN_LIST;
}

/** Built-ins first (stable order), then user-installed themes. */
export function listAllSkins(): ForgeSkin[] {
  return [...BUILTIN_SKIN_LIST, ...listUserSkins()];
}

export function isKnownSkinName(name: string): boolean {
  return Boolean(BUILTIN_SKINS[name] || getUserThemes()[name]);
}