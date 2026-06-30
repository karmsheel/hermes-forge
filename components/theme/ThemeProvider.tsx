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
import {
  applyAccent,
  getStoredAccent,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  type AccentId,
} from "@/lib/accent";
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
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT);

  const syncResolved = useCallback((next: ThemePreference) => {
    setResolved(resolveThemePreference(next));
  }, []);

  useEffect(() => {
    const stored = getStoredTheme();
    const storedAccent = getStoredAccent();
    setPreferenceState(stored);
    setAccentState(storedAccent);
    applyThemePreference(stored);
    applyAccent(storedAccent);
    syncResolved(stored);
  }, [syncResolved]);

  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncResolved("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference, syncResolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      applyThemePreference(next);
      syncResolved(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [syncResolved]
  );

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    applyAccent(next);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, accent, setAccent }),
    [preference, resolved, setPreference, accent, setAccent]
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