import { mix } from "./color";
import type { ForgeSkin, SkinColors } from "./types";

/** Muzli Nous palette — https://colors.muz.li/palette/0000f2/002aa9/bfcfff/809fff/ffffff */
const NOUS = {
  blue: "#0000f2",
  dark: "#002aa9",
  light: "#bfcfff",
  mid: "#809fff",
  white: "#ffffff",
} as const;

function nousLine(pct: number): string {
  return mix(NOUS.blue, NOUS.white, (100 - pct) / 100);
}

function nousLineDark(pct: number): string {
  return mix(NOUS.mid, NOUS.dark, (100 - pct) / 100);
}

function nousSurfaceTint(pct: number): string {
  return `color-mix(in srgb, ${NOUS.light} ${pct}%, ${NOUS.white})`;
}

/** Preserves the original Hermes Forge terracotta palette (Phase 1.1 default). */
export const forgeSkin: ForgeSkin = {
  name: "forge",
  label: "Forge",
  description: "Warm terracotta — the classic Hermes Forge look",
  colors: {
    background: "#faf9f7",
    foreground: "#1a1916",
    card: "#fffefc",
    cardForeground: "#1a1916",
    muted: "#f4f5f7",
    mutedForeground: "#74716b",
    popover: "#fffefc",
    popoverForeground: "#1a1916",
    primary: "#c96442",
    primaryForeground: "#ffffff",
    secondary: "#fbeee5",
    secondaryForeground: "#1a1916",
    accent: "#f5d8cb",
    accentForeground: "#1a1916",
    border: "#e1e5eb",
    input: "#e1e5eb",
    ring: "#2563eb",
    midground: "#2563eb",
    destructive: "#9c2a25",
    destructiveForeground: "#ffffff",
    sidebarBackground: "#fdfcfa",
    sidebarBorder: "#e1e5eb",
  },
  darkColors: {
    background: "#1a1917",
    foreground: "#e8e4dc",
    card: "#2a2825",
    cardForeground: "#e8e4dc",
    muted: "#252321",
    mutedForeground: "#9a9690",
    popover: "#2a2825",
    popoverForeground: "#e8e4dc",
    primary: "#d97a56",
    primaryForeground: "#1a1917",
    secondary: "#2e1a12",
    secondaryForeground: "#e8e4dc",
    accent: "#3d2318",
    accentForeground: "#e8e4dc",
    border: "#333128",
    input: "#333128",
    ring: "#2563eb",
    midground: "#2563eb",
    destructive: "#e06b65",
    destructiveForeground: "#1a1917",
    sidebarBackground: "#222120",
    sidebarBorder: "#333128",
  },
};

export const nousSkin: ForgeSkin = {
  name: "nous",
  label: "Nous",
  description: "Crisp blue on white — the Nous palette",
  colors: {
    background: NOUS.white,
    foreground: NOUS.dark,
    card: NOUS.white,
    cardForeground: NOUS.dark,
    muted: NOUS.light,
    mutedForeground: NOUS.mid,
    popover: NOUS.white,
    popoverForeground: NOUS.dark,
    primary: NOUS.blue,
    primaryForeground: NOUS.white,
    secondary: NOUS.light,
    secondaryForeground: NOUS.dark,
    accent: nousSurfaceTint(50),
    accentForeground: NOUS.dark,
    border: nousLine(28),
    input: nousLine(35),
    ring: NOUS.blue,
    midground: NOUS.blue,
    composerRing: NOUS.blue,
    destructive: "#C72E4D",
    destructiveForeground: NOUS.white,
    sidebarBackground: nousSurfaceTint(35),
    sidebarBorder: nousLine(28),
    userBubble: NOUS.dark,
    userBubbleBorder: nousLine(40),
  },
  darkColors: {
    background: "#0D2F86",
    foreground: "#FFE6CB",
    card: "#12378F",
    cardForeground: "#FFE6CB",
    muted: "#183F9A",
    mutedForeground: "#B5C7F3",
    popover: "#123A96",
    popoverForeground: "#FFE6CB",
    primary: "#FFE6CB",
    primaryForeground: "#0D2F86",
    secondary: "#1B45A4",
    secondaryForeground: "#E0E8FF",
    accent: "#1540B1",
    accentForeground: "#F0F4FF",
    border: "#3158AD",
    input: "#0B2566",
    ring: "#FFE6CB",
    midground: "#0053FD",
    destructive: "#C0473A",
    destructiveForeground: "#FEF2F2",
    sidebarBackground: "#09286F",
    sidebarBorder: "#234A9C",
  },
};

export const midnightSkin: ForgeSkin = {
  name: "midnight",
  label: "Midnight",
  description: "Deep blue-violet with cool accents",
  colors: {
    background: "#08081c",
    foreground: "#ddd6ff",
    card: "#0d0d28",
    cardForeground: "#ddd6ff",
    muted: "#13133a",
    mutedForeground: "#7c7ab0",
    popover: "#0f0f2e",
    popoverForeground: "#ddd6ff",
    primary: "#ddd6ff",
    primaryForeground: "#08081c",
    secondary: "#1a1a4a",
    secondaryForeground: "#c4bff0",
    accent: "#1a1a44",
    accentForeground: "#d0c8ff",
    border: "#1e1e52",
    input: "#1e1e52",
    ring: "#8b80e8",
    midground: "#8b80e8",
    destructive: "#b03060",
    destructiveForeground: "#fef2f2",
    sidebarBackground: "#06061a",
    sidebarBorder: "#12123a",
  },
};

export const emberSkin: ForgeSkin = {
  name: "ember",
  label: "Ember",
  description: "Warm crimson and bronze — forge vibes",
  colors: {
    background: "#160800",
    foreground: "#ffd8b0",
    card: "#1e0e04",
    cardForeground: "#ffd8b0",
    muted: "#2a1408",
    mutedForeground: "#aa7a56",
    popover: "#221008",
    popoverForeground: "#ffd8b0",
    primary: "#ffd8b0",
    primaryForeground: "#160800",
    secondary: "#341800",
    secondaryForeground: "#f0c090",
    accent: "#301600",
    accentForeground: "#e8c080",
    border: "#3a1c08",
    input: "#3a1c08",
    ring: "#d97316",
    midground: "#d97316",
    destructive: "#c43010",
    destructiveForeground: "#fef2f2",
    sidebarBackground: "#100600",
    sidebarBorder: "#2a1004",
  },
};

export const monoSkin: ForgeSkin = {
  name: "mono",
  label: "Mono",
  description: "Clean grayscale — minimal and focused",
  colors: {
    background: "#0e0e0e",
    foreground: "#eaeaea",
    card: "#141414",
    cardForeground: "#eaeaea",
    muted: "#1e1e1e",
    mutedForeground: "#808080",
    popover: "#181818",
    popoverForeground: "#eaeaea",
    primary: "#eaeaea",
    primaryForeground: "#0e0e0e",
    secondary: "#262626",
    secondaryForeground: "#c8c8c8",
    accent: "#222222",
    accentForeground: "#d8d8d8",
    border: "#2a2a2a",
    input: "#2a2a2a",
    ring: "#9a9a9a",
    midground: "#9a9a9a",
    destructive: "#a84040",
    destructiveForeground: "#fef2f2",
    sidebarBackground: "#0a0a0a",
    sidebarBorder: "#202020",
  },
};

export const cyberpunkSkin: ForgeSkin = {
  name: "cyberpunk",
  label: "Cyberpunk",
  description: "Neon green on black — matrix terminal",
  colors: {
    background: "#000a00",
    foreground: "#00ff41",
    card: "#001200",
    cardForeground: "#00ff41",
    muted: "#001a00",
    mutedForeground: "#1a8a30",
    popover: "#001000",
    popoverForeground: "#00ff41",
    primary: "#00ff41",
    primaryForeground: "#000a00",
    secondary: "#002800",
    secondaryForeground: "#00cc34",
    accent: "#002000",
    accentForeground: "#00e038",
    border: "#003000",
    input: "#003000",
    ring: "#00ff41",
    midground: "#00ff41",
    destructive: "#ff003c",
    destructiveForeground: "#000a00",
    sidebarBackground: "#000600",
    sidebarBorder: "#001800",
  },
};

export const slateSkin: ForgeSkin = {
  name: "slate",
  label: "Slate",
  description: "Cool slate blue — focused developer theme",
  colors: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    card: "#161b22",
    cardForeground: "#c9d1d9",
    muted: "#21262d",
    mutedForeground: "#8b949e",
    popover: "#1c2128",
    popoverForeground: "#c9d1d9",
    primary: "#c9d1d9",
    primaryForeground: "#0d1117",
    secondary: "#2a3038",
    secondaryForeground: "#adb5bf",
    accent: "#1e2530",
    accentForeground: "#c0c8d0",
    border: "#30363d",
    input: "#30363d",
    ring: "#58a6ff",
    midground: "#58a6ff",
    destructive: "#cf4848",
    destructiveForeground: "#fef2f2",
    sidebarBackground: "#090d13",
    sidebarBorder: "#1c2228",
  },
};

export const BUILTIN_SKINS: Record<string, ForgeSkin> = {
  forge: forgeSkin,
  nous: nousSkin,
  midnight: midnightSkin,
  ember: emberSkin,
  mono: monoSkin,
  cyberpunk: cyberpunkSkin,
  slate: slateSkin,
};

export const BUILTIN_SKIN_LIST = Object.values(BUILTIN_SKINS);

export const DEFAULT_SKIN_NAME = "forge";

export const BUILTIN_SKIN_NAMES = BUILTIN_SKIN_LIST.map((s) => s.name);

export function isBuiltinSkinName(value: string | null): value is string {
  return Boolean(value && BUILTIN_SKINS[value]);
}

export function resolveSkinPalette(skin: ForgeSkin, mode: "light" | "dark"): SkinColors {
  if (mode === "dark" && skin.darkColors) return skin.darkColors;
  return skin.colors;
}