import { isDarkBackground, mix } from "./color";
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

/** Subtle wash from brand blue — keeps #0000f2 as the only vivid blue. */
function nousBrandTint(pct: number): string {
  return mix(NOUS.blue, NOUS.white, (100 - pct) / 100);
}

/** Neutral structural borders — avoids competing with the brand blue. */
function nousNeutralLine(pct: number): string {
  return mix("#0A0A12", NOUS.white, (100 - pct) / 100);
}

export const nousSkin: ForgeSkin = {
  name: "nous",
  label: "Nous",
  description: "Crisp blue on white — the Nous palette",
  // Matches hermes-agent.nousresearch.com display face (Sigurd via next/font --font-sigurd).
  typography: {
    fontDisplay: 'var(--font-sigurd), "Times New Roman", serif',
  },
  colors: {
    background: NOUS.white,
    foreground: "#0A0A12",
    card: NOUS.white,
    cardForeground: "#0A0A12",
    muted: nousBrandTint(6),
    mutedForeground: "#5C5C70",
    popover: NOUS.white,
    popoverForeground: "#0A0A12",
    primary: NOUS.blue,
    primaryForeground: NOUS.white,
    secondary: nousBrandTint(8),
    secondaryForeground: NOUS.dark,
    accent: nousBrandTint(10),
    accentForeground: NOUS.dark,
    border: nousNeutralLine(12),
    input: nousNeutralLine(16),
    ring: NOUS.blue,
    midground: NOUS.blue,
    composerRing: NOUS.blue,
    destructive: "#C72E4D",
    destructiveForeground: NOUS.white,
    sidebarBackground: nousBrandTint(5),
    sidebarBorder: nousNeutralLine(12),
    userBubble: NOUS.blue,
    userBubbleBorder: nousLine(32),
    composerPlaceholder: "#00cedd",
    info: NOUS.blue,
    success: "#1A7A42",
  },
  // Night mode mirrors hermes-agent.nousresearch.com: solid brand blue + pure white
  // (no cream). Surfaces lift with white tints; wells drop with black tints.
  darkColors: {
    background: NOUS.blue,
    foreground: NOUS.white,
    card: mix(NOUS.blue, NOUS.white, 0.08),
    cardForeground: NOUS.white,
    muted: mix(NOUS.blue, NOUS.white, 0.12),
    mutedForeground: mix(NOUS.white, NOUS.blue, 0.28),
    popover: mix(NOUS.blue, NOUS.white, 0.1),
    popoverForeground: NOUS.white,
    primary: NOUS.white,
    primaryForeground: NOUS.blue,
    secondary: mix(NOUS.blue, NOUS.white, 0.14),
    secondaryForeground: mix(NOUS.white, NOUS.blue, 0.08),
    accent: mix(NOUS.blue, NOUS.white, 0.16),
    accentForeground: NOUS.white,
    // Near-white chrome so home cards (and other surfaces) read with a clear outline
    border: mix(NOUS.white, NOUS.blue, 0.08),
    input: mix(NOUS.blue, "#000000", 0.15),
    ring: NOUS.white,
    midground: NOUS.mid,
    composerRing: NOUS.white,
    destructive: "#C0473A",
    destructiveForeground: NOUS.white,
    // Deeper brand blue for the left nav rail
    sidebarBackground: mix(NOUS.blue, "#000000", 0.32),
    sidebarBorder: mix(NOUS.white, NOUS.blue, 0.22),
    // Inverted from day: white composer/bubble on brand blue
    userBubble: NOUS.white,
    userBubbleBorder: mix(NOUS.white, NOUS.blue, 0.18),
    composerForeground: NOUS.blue,
    composerPlaceholder: mix(NOUS.blue, NOUS.white, 0.42),
    info: NOUS.light,
    success: "#5AD68A",
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

/** Black lacquer + aged brass — horological prestige palette. */
const BRASS = {
  background: "#0C0C0C",
  card: "#181818",
  brass: "#B88A2E",
  gold: "#F4D06F",
  text: "#ECECEC",
  mutedText: "#888888",
} as const;

function brassLine(pct: number): string {
  return mix(BRASS.brass, BRASS.background, (100 - pct) / 100);
}

function brassSurface(pct: number): string {
  return mix(BRASS.brass, BRASS.card, (100 - pct) / 100);
}

export const blackBrassSkin: ForgeSkin = {
  name: "black-brass",
  label: "Black & Brass",
  description: "Obsidian black with aged brass and gold — craftsmanship and prestige",
  colors: {
    background: BRASS.background,
    foreground: BRASS.text,
    card: BRASS.card,
    cardForeground: BRASS.text,
    muted: "#141414",
    mutedForeground: BRASS.mutedText,
    popover: "#1A1A1A",
    popoverForeground: BRASS.text,
    primary: BRASS.gold,
    primaryForeground: BRASS.background,
    secondary: brassSurface(22),
    secondaryForeground: mix(BRASS.gold, BRASS.text, 0.35),
    accent: brassSurface(38),
    accentForeground: BRASS.gold,
    border: brassLine(18),
    input: brassLine(24),
    ring: BRASS.brass,
    midground: BRASS.gold,
    composerRing: BRASS.brass,
    destructive: "#A84838",
    destructiveForeground: "#FEF2F2",
    sidebarBackground: "#080808",
    sidebarBorder: brassLine(12),
    userBubble: BRASS.card,
    userBubbleBorder: brassLine(32),
    success: "#6B9E5C",
    info: "#6B8AAE",
  },
};

/** Gunmetal + electric cyan — industrial AI forge (Claude / Cursor / Vercel vibes). */
const CYBER = {
  background: "#090A0F",
  card: "#151821",
  primary: "#36C2F6",
  secondary: "#6EE7FF",
  success: "#3DD68C",
  text: "#F2F4F8",
} as const;

function cyberLine(pct: number): string {
  return mix(CYBER.primary, CYBER.background, (100 - pct) / 100);
}

function cyberSurface(pct: number): string {
  return mix(CYBER.secondary, CYBER.card, (100 - pct) / 100);
}

export const cyberForgeSkin: ForgeSkin = {
  name: "cyber-forge",
  label: "Cyber Forge",
  description: "Gunmetal and electric cyan — industrial AI forge",
  colors: {
    background: CYBER.background,
    foreground: CYBER.text,
    card: CYBER.card,
    cardForeground: CYBER.text,
    muted: mix(CYBER.background, CYBER.card, 0.38),
    mutedForeground: mix(CYBER.text, CYBER.background, 0.52),
    popover: "#1A1F2B",
    popoverForeground: CYBER.text,
    primary: CYBER.primary,
    primaryForeground: CYBER.background,
    secondary: cyberSurface(18),
    secondaryForeground: CYBER.secondary,
    accent: cyberSurface(32),
    accentForeground: CYBER.secondary,
    border: cyberLine(16),
    input: cyberLine(22),
    ring: CYBER.primary,
    midground: CYBER.secondary,
    composerRing: CYBER.primary,
    destructive: "#F05252",
    destructiveForeground: CYBER.text,
    sidebarBackground: "#06070B",
    sidebarBorder: cyberLine(10),
    userBubble: CYBER.card,
    userBubbleBorder: cyberLine(28),
    success: CYBER.success,
    info: "#4DA8FF",
  },
};

/** Slate + emerald — calm operations platform palette. */
const OPS = {
  background: "#0C1117",
  card: "#161B22",
  primary: "#3FB950",
  accent: "#58D68D",
  text: "#F0F6FC",
} as const;

function opsLine(pct: number): string {
  return mix(OPS.primary, OPS.background, (100 - pct) / 100);
}

function opsSurface(pct: number): string {
  return mix(OPS.accent, OPS.card, (100 - pct) / 100);
}

export const slateEmeraldSkin: ForgeSkin = {
  name: "slate-emerald",
  label: "Slate & Emerald",
  description: "Cool slate with emerald accents — trustworthy operations platform",
  colors: {
    background: OPS.background,
    foreground: OPS.text,
    card: OPS.card,
    cardForeground: OPS.text,
    muted: mix(OPS.background, OPS.card, 0.38),
    mutedForeground: mix(OPS.text, OPS.background, 0.54),
    popover: "#1C2128",
    popoverForeground: OPS.text,
    primary: OPS.primary,
    primaryForeground: OPS.background,
    secondary: opsSurface(18),
    secondaryForeground: OPS.accent,
    accent: opsSurface(30),
    accentForeground: OPS.accent,
    border: opsLine(14),
    input: opsLine(20),
    ring: OPS.primary,
    midground: OPS.accent,
    composerRing: OPS.primary,
    destructive: "#F85149",
    destructiveForeground: OPS.text,
    sidebarBackground: "#090D13",
    sidebarBorder: opsLine(9),
    userBubble: OPS.card,
    userBubbleBorder: opsLine(26),
    success: OPS.primary,
    info: "#58A6FF",
  },
};

/** Iron + ember — cooling forge: steel, ash, and low embers. */
const IRON_EMBER_LIGHT = {
  background: "#F0EEEA",
  card: "#F8F7F5",
  primary: "#B4532A",
  accent: "#E86A33",
  highlight: "#9A4A24",
  text: "#1E1E22",
  muted: "#6E6C68",
} as const;

const IRON_EMBER_DARK = {
  background: "#111214",
  card: "#1A1D22",
  primary: "#A8552D",
  accent: "#E86A33",
  highlight: "#FFB56B",
  text: "#F3F3F3",
  muted: "#8B8B8B",
} as const;

function ironEmberLine(
  tokens: typeof IRON_EMBER_LIGHT | typeof IRON_EMBER_DARK,
  pct: number,
): string {
  return mix(tokens.primary, tokens.background, (100 - pct) / 100);
}

function ironEmberSurface(
  tokens: typeof IRON_EMBER_LIGHT | typeof IRON_EMBER_DARK,
  pct: number,
): string {
  return mix(tokens.accent, tokens.card, (100 - pct) / 100);
}

export const ironEmberSkin: ForgeSkin = {
  name: "iron-ember",
  label: "Iron & Ember",
  description: "Cooling steel and ash with low ember glow — modern industrial warmth",
  colors: {
    background: IRON_EMBER_LIGHT.background,
    foreground: IRON_EMBER_LIGHT.text,
    card: IRON_EMBER_LIGHT.card,
    cardForeground: IRON_EMBER_LIGHT.text,
    muted: mix(IRON_EMBER_LIGHT.background, IRON_EMBER_LIGHT.card, 0.42),
    mutedForeground: IRON_EMBER_LIGHT.muted,
    popover: "#FFFFFF",
    popoverForeground: IRON_EMBER_LIGHT.text,
    primary: IRON_EMBER_LIGHT.primary,
    primaryForeground: "#FFFFFF",
    secondary: ironEmberSurface(IRON_EMBER_LIGHT, 14),
    secondaryForeground: IRON_EMBER_LIGHT.highlight,
    accent: ironEmberSurface(IRON_EMBER_LIGHT, 26),
    accentForeground: IRON_EMBER_LIGHT.highlight,
    border: ironEmberLine(IRON_EMBER_LIGHT, 14),
    input: ironEmberLine(IRON_EMBER_LIGHT, 20),
    ring: IRON_EMBER_LIGHT.accent,
    midground: IRON_EMBER_LIGHT.accent,
    composerRing: IRON_EMBER_LIGHT.accent,
    destructive: "#C43010",
    destructiveForeground: "#FFFFFF",
    sidebarBackground: "#EBE8E4",
    sidebarBorder: ironEmberLine(IRON_EMBER_LIGHT, 10),
    userBubble: IRON_EMBER_LIGHT.text,
    userBubbleBorder: ironEmberLine(IRON_EMBER_LIGHT, 28),
    success: "#2F7A4A",
    info: "#3D6F94",
  },
  darkColors: {
    background: IRON_EMBER_DARK.background,
    foreground: IRON_EMBER_DARK.text,
    card: IRON_EMBER_DARK.card,
    cardForeground: IRON_EMBER_DARK.text,
    muted: mix(IRON_EMBER_DARK.background, IRON_EMBER_DARK.card, 0.36),
    mutedForeground: IRON_EMBER_DARK.muted,
    popover: "#1E2229",
    popoverForeground: IRON_EMBER_DARK.text,
    primary: IRON_EMBER_DARK.primary,
    primaryForeground: IRON_EMBER_DARK.text,
    secondary: ironEmberSurface(IRON_EMBER_DARK, 16),
    secondaryForeground: IRON_EMBER_DARK.highlight,
    accent: ironEmberSurface(IRON_EMBER_DARK, 28),
    accentForeground: IRON_EMBER_DARK.highlight,
    border: ironEmberLine(IRON_EMBER_DARK, 12),
    input: ironEmberLine(IRON_EMBER_DARK, 18),
    ring: IRON_EMBER_DARK.accent,
    midground: IRON_EMBER_DARK.accent,
    composerRing: IRON_EMBER_DARK.accent,
    destructive: "#D64545",
    destructiveForeground: IRON_EMBER_DARK.text,
    sidebarBackground: "#0D0E10",
    sidebarBorder: ironEmberLine(IRON_EMBER_DARK, 8),
    userBubble: IRON_EMBER_DARK.card,
    userBubbleBorder: ironEmberLine(IRON_EMBER_DARK, 24),
    success: "#5A9E6F",
    info: "#6B8FA8",
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
  "iron-ember": ironEmberSkin,
  nous: nousSkin,
  midnight: midnightSkin,
  ember: emberSkin,
  mono: monoSkin,
  cyberpunk: cyberpunkSkin,
  "cyber-forge": cyberForgeSkin,
  "slate-emerald": slateEmeraldSkin,
  slate: slateSkin,
  "black-brass": blackBrassSkin,
};

export const BUILTIN_SKIN_LIST = Object.values(BUILTIN_SKINS);

export const DEFAULT_SKIN_NAME = "iron-ember";

export const BUILTIN_SKIN_NAMES = BUILTIN_SKIN_LIST.map((s) => s.name);

export function isBuiltinSkinName(value: string | null): value is string {
  return Boolean(value && BUILTIN_SKINS[value]);
}

export function resolveSkinPalette(skin: ForgeSkin, mode: "light" | "dark"): SkinColors {
  if (mode === "dark" && skin.darkColors) return skin.darkColors;
  return skin.colors;
}

/** Whether a skin has a palette appropriate for the given color mode. */
export function skinSupportsMode(skin: ForgeSkin, mode: "light" | "dark"): boolean {
  const dark = isDarkBackground(resolveSkinPalette(skin, mode).background);
  return mode === "dark" ? dark : !dark;
}

export function filterSkinsForMode(skins: ForgeSkin[], mode: "light" | "dark"): ForgeSkin[] {
  return skins.filter((skin) => skinSupportsMode(skin, mode));
}

/** Whether a skin has distinct palettes for both day and night. */
export function skinSupportsBothModes(skin: ForgeSkin): boolean {
  return skinSupportsMode(skin, "light") && skinSupportsMode(skin, "dark");
}

export function filterSkinsForPreference(
  skins: ForgeSkin[],
  preference: "system" | "light" | "dark",
): ForgeSkin[] {
  if (preference === "system") {
    return skins.filter(skinSupportsBothModes);
  }
  return filterSkinsForMode(skins, preference);
}

