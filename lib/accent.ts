export type AccentId =
  | "terracotta"
  | "coral"
  | "amber"
  | "sage"
  | "ocean"
  | "plum"
  | "rose"
  | "slate";

export const ACCENT_STORAGE_KEY = "hermes-forge-accent";
export const DEFAULT_ACCENT: AccentId = "terracotta";

export const ACCENT_IDS: AccentId[] = [
  "terracotta",
  "coral",
  "amber",
  "sage",
  "ocean",
  "plum",
  "rose",
  "slate",
];

export interface AccentPreset {
  id: AccentId;
  label: string;
  /** Swatch preview in light mode */
  swatchLight: string;
  /** Swatch preview in dark mode */
  swatchDark: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "terracotta", label: "Terracotta", swatchLight: "#c96442", swatchDark: "#d97a56" },
  { id: "coral", label: "Coral", swatchLight: "#e85d4c", swatchDark: "#f07565" },
  { id: "amber", label: "Amber", swatchLight: "#c4820a", swatchDark: "#e09a40" },
  { id: "sage", label: "Sage", swatchLight: "#4a8f5c", swatchDark: "#5dad72" },
  { id: "ocean", label: "Ocean", swatchLight: "#2b6cb0", swatchDark: "#5b9fd4" },
  { id: "plum", label: "Plum", swatchLight: "#7c4dbd", swatchDark: "#a67ee8" },
  { id: "rose", label: "Rose", swatchLight: "#c44d7a", swatchDark: "#e87098" },
  { id: "slate", label: "Slate", swatchLight: "#4a6278", swatchDark: "#7a9ab8" },
];

export function isAccentId(value: string | null): value is AccentId {
  return ACCENT_IDS.includes(value as AccentId);
}

export function getStoredAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_ACCENT;
}

export function applyAccent(accent: AccentId) {
  document.documentElement.setAttribute("data-accent", accent);
}