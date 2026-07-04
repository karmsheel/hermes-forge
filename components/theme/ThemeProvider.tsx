"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applySkin } from "@/lib/themes/apply-skin";
import { DEFAULT_SKIN_NAME } from "@/lib/themes/presets";
import { listAllSkins, resolveSkin } from "@/lib/themes/registry";
import { getStoredSkinName, persistSkinName } from "@/lib/themes/storage";
import {
  installUserThemeFromJson,
  isUserSkinName,
  removeUserTheme,
} from "@/lib/themes/user-themes";
import type { ForgeSkin } from "@/lib/themes/types";
import {
  applyThemePreference,
  getStoredTheme,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
  skin: ForgeSkin;
  skinName: string;
  setSkin: (skinName: string) => void;
  availableSkins: ForgeSkin[];
  userSkinNames: Set<string>;
  installSkin: (json: string) => ForgeSkin;
  removeSkin: (skinName: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [skinName, setSkinNameState] = useState("forge");
  const [userThemesVersion, setUserThemesVersion] = useState(0);

  const refreshUserThemes = useCallback(() => {
    setUserThemesVersion((v) => v + 1);
  }, []);

  const availableSkins = useMemo(() => listAllSkins(), [userThemesVersion]);

  const userSkinNames = useMemo(() => {
    void userThemesVersion;
    return new Set(availableSkins.filter((skin) => isUserSkinName(skin.name)).map((s) => s.name));
  }, [availableSkins, userThemesVersion]);

  const syncResolved = useCallback((next: ThemePreference) => {
    setResolved(resolveThemePreference(next));
  }, []);

  const applyCurrentSkin = useCallback((name: string, mode: "light" | "dark") => {
    applySkin(resolveSkin(name), mode);
  }, []);

  useEffect(() => {
    const storedTheme = getStoredTheme();
    const storedSkin = getStoredSkinName();
    setPreferenceState(storedTheme);
    setSkinNameState(storedSkin);
    applyThemePreference(storedTheme);
    const mode = resolveThemePreference(storedTheme);
    setResolved(mode);
    applyCurrentSkin(storedSkin, mode);
    refreshUserThemes();
  }, [applyCurrentSkin, refreshUserThemes]);

  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const mode = resolveThemePreference("system");
      setResolved(mode);
      applyCurrentSkin(skinName, mode);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [applyCurrentSkin, preference, skinName]);

  useEffect(() => {
    applyCurrentSkin(skinName, resolved);
  }, [applyCurrentSkin, resolved, skinName]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      applyThemePreference(next);
      const mode = resolveThemePreference(next);
      syncResolved(next);
      applyCurrentSkin(skinName, mode);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [applyCurrentSkin, skinName, syncResolved],
  );

  const setSkin = useCallback(
    (nextName: string) => {
      const skin = resolveSkin(nextName);
      setSkinNameState(skin.name);
      persistSkinName(skin.name);
      applyCurrentSkin(skin.name, resolved);
    },
    [applyCurrentSkin, resolved],
  );

  const installSkin = useCallback(
    (json: string) => {
      const theme = installUserThemeFromJson(json);
      refreshUserThemes();
      setSkin(theme.name);
      return theme;
    },
    [refreshUserThemes, setSkin],
  );

  const removeSkin = useCallback(
    (name: string) => {
      if (!isUserSkinName(name)) return;
      removeUserTheme(name);
      refreshUserThemes();
      if (skinName === name) {
        setSkin(DEFAULT_SKIN_NAME);
      }
    },
    [refreshUserThemes, setSkin, skinName],
  );

  const skin = useMemo(() => resolveSkin(skinName), [skinName, userThemesVersion]);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference,
      skin,
      skinName,
      setSkin,
      availableSkins,
      userSkinNames,
      installSkin,
      removeSkin,
    }),
    [
      availableSkins,
      installSkin,
      preference,
      removeSkin,
      resolved,
      setPreference,
      skin,
      skinName,
      setSkin,
      userSkinNames,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}