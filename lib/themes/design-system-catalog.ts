import type { ForgeSkinVars, SkinColors } from "./types";

export interface DesignTokenEntry {
  key: string;
  label: string;
  value: string;
}

export interface DesignTokenGroup {
  id: string;
  label: string;
  tokens: DesignTokenEntry[];
}

const SKIN_COLOR_GROUP_DEFS: { id: string; label: string; keys: (keyof SkinColors)[] }[] = [
  {
    id: "surfaces",
    label: "Surfaces",
    keys: ["background", "card", "muted", "popover", "sidebarBackground"],
  },
  {
    id: "text",
    label: "Text",
    keys: [
      "foreground",
      "cardForeground",
      "mutedForeground",
      "popoverForeground",
      "primaryForeground",
      "secondaryForeground",
      "accentForeground",
      "destructiveForeground",
    ],
  },
  {
    id: "brand",
    label: "Brand & accent",
    keys: ["primary", "secondary", "accent", "ring", "midground", "midgroundForeground"],
  },
  {
    id: "borders",
    label: "Borders & inputs",
    keys: ["border", "input", "sidebarBorder"],
  },
  {
    id: "semantic",
    label: "Semantic",
    keys: ["destructive"],
  },
  {
    id: "composer",
    label: "Composer & chat",
    keys: ["composerRing", "userBubble", "userBubbleBorder", "composerForeground", "composerPlaceholder"],
  },
];

const FORGE_VAR_GROUP_DEFS: { id: string; label: string; keys: (keyof ForgeSkinVars)[] }[] = [
  {
    id: "surfaces",
    label: "Surfaces",
    keys: [
      "--bg",
      "--bg-app",
      "--bg-panel",
      "--bg-subtle",
      "--bg-muted",
      "--bg-elevated",
      "--bg-fill-tertiary",
      "--bg-fill-secondary",
    ],
  },
  {
    id: "borders",
    label: "Borders & lines",
    keys: ["--border", "--border-strong", "--border-soft", "--line", "--sidebar-border"],
  },
  {
    id: "text",
    label: "Text",
    keys: ["--text", "--text-strong", "--text-muted", "--text-soft", "--text-faint"],
  },
  {
    id: "accent",
    label: "Accent",
    keys: [
      "--accent",
      "--accent-fg",
      "--accent-strong",
      "--accent-soft",
      "--accent-tint",
      "--accent-hover",
      "--accent-hover-fg",
    ],
  },
  {
    id: "selection",
    label: "Selection & focus",
    keys: ["--selected", "--selected-soft"],
  },
  {
    id: "semantic",
    label: "Semantic",
    keys: [
      "--green",
      "--green-bg",
      "--green-border",
      "--blue",
      "--blue-bg",
      "--blue-border",
      "--amber",
      "--amber-bg",
      "--red",
      "--red-bg",
      "--red-border",
    ],
  },
  {
    id: "composer",
    label: "Composer",
    keys: [
      "--composer-bg",
      "--composer-fg",
      "--composer-fg-muted",
      "--composer-fg-soft",
      "--composer-fg-faint",
      "--composer-border",
      "--composer-border-soft",
      "--composer-border-strong",
    ],
  },
  {
    id: "elevation",
    label: "Elevation",
    keys: ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-nous", "--stroke-nous"],
  },
];

function skinKeyLabel(key: keyof SkinColors): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function forgeVarLabel(key: string): string {
  return key
    .replace(/^--/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function presentSkinValue(palette: SkinColors, key: keyof SkinColors): string | null {
  const value = palette[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

function presentForgeValue(vars: ForgeSkinVars, key: string): string | null {
  const value = vars[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

export function buildSkinPaletteGroups(palette: SkinColors): DesignTokenGroup[] {
  return SKIN_COLOR_GROUP_DEFS.map((group) => {
    const tokens: DesignTokenEntry[] = [];
    for (const key of group.keys) {
      const value = presentSkinValue(palette, key);
      if (!value) continue;
      tokens.push({ key, label: skinKeyLabel(key), value });
    }
    return { id: `skin-${group.id}`, label: group.label, tokens };
  }).filter((group) => group.tokens.length > 0);
}

export function buildForgeTokenGroups(vars: ForgeSkinVars): DesignTokenGroup[] {
  return FORGE_VAR_GROUP_DEFS.map((group) => {
    const tokens: DesignTokenEntry[] = [];
    for (const key of group.keys) {
      const value = presentForgeValue(vars, key);
      if (!value) continue;
      tokens.push({ key, label: forgeVarLabel(key), value });
    }
    return { id: `forge-${group.id}`, label: group.label, tokens };
  }).filter((group) => group.tokens.length > 0);
}

export function countDesignTokens(groups: DesignTokenGroup[]): number {
  return groups.reduce((sum, group) => sum + group.tokens.length, 0);
}

export function isShadowTokenValue(value: string): boolean {
  return /^\s*0\s+[\d.]+(?:px|rem)/.test(value) || (value.includes(",") && /\d(?:px|rem)/.test(value));
}

export function isSolidSwatchValue(value: string): boolean {
  if (value.startsWith("#")) return true;
  if (value.startsWith("rgb")) return true;
  if (value.startsWith("color-mix")) return true;
  if (value.startsWith("var(")) return false;
  return false;
}