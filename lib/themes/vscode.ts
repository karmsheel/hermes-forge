/**
 * VS Code color-theme → ForgeSkin converter.
 * Ported from Hermes Desktop `apps/desktop/src/themes/vscode.ts`.
 */

import {
  ensureContrast,
  luminance,
  mix,
  normalizeHex,
  readableOn,
} from "./color";
import type { ForgeSkin, SkinColors } from "./types";

const ACCENT_MIN_CONTRAST = 4.5;

export interface VscodeColorTheme {
  name?: string;
  type?: string;
  include?: string;
  colors?: Record<string, unknown>;
  tokenColors?: unknown;
}

export interface ConvertVscodeOptions {
  slug?: string;
  label?: string;
  source?: string;
}

export interface ConvertVscodeResult {
  theme: ForgeSkin;
  mode: "light" | "dark";
  derived: string[];
}

export function vscodeThemeSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `vsc-${base || "theme"}`;
}

/** Parse VS Code theme JSON (supports JSONC: comments + trailing commas). */
export function parseVscodeTheme(text: string): VscodeColorTheme {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/[^\n\r]*/g, "$1")
    .replace(/,(\s*[}\]])/g, "$1");

  const parsed: unknown = JSON.parse(stripped);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Theme file is not a JSON object.");
  }

  return parsed as VscodeColorTheme;
}

function isDarkType(raw: VscodeColorTheme, background: string): boolean {
  const type = (raw.type ?? "").toLowerCase();
  if (type.includes("light")) return false;
  if (type === "dark" || type === "hc" || type === "hc-black" || type.includes("dark")) {
    return true;
  }
  return luminance(background) < 0.4;
}

const pick = (
  colors: Record<string, unknown>,
  keys: string[],
  backdrop: string,
): { key: string; value: string } | null => {
  for (const key of keys) {
    const value = normalizeHex(typeof colors[key] === "string" ? (colors[key] as string) : null, backdrop);
    if (value) return { key, value };
  }
  return null;
};

export function convertVscodeColorTheme(
  raw: VscodeColorTheme,
  opts: ConvertVscodeOptions = {},
): ConvertVscodeResult {
  const colors =
    raw.colors && typeof raw.colors === "object" ? (raw.colors as Record<string, unknown>) : null;

  if (!colors) {
    throw new Error('Theme has no "colors" map — not a VS Code color theme.');
  }

  const derived: string[] = [];

  const backgroundHit = pick(
    colors,
    ["editor.background", "editorPane.background", "editorGroup.background"],
    "#000000",
  );

  const dark = isDarkType(raw, backgroundHit?.value ?? "#1e1e1e");
  const background = backgroundHit?.value ?? (dark ? "#1e1e1e" : "#ffffff");

  if (!backgroundHit) derived.push("editor.background");

  const take = (keys: string[], fallback: string): string => {
    const hit = pick(colors, keys, background);
    if (hit) return hit.value;
    derived.push(keys[0]);
    return fallback;
  };

  const foreground = take(["editor.foreground", "foreground"], dark ? "#d4d4d4" : "#1f1f1f");

  const accentSource = take(
    [
      "button.background",
      "textLink.activeForeground",
      "textLink.foreground",
      "activityBarBadge.background",
      "badge.background",
      "progressBar.background",
      "pickerGroup.foreground",
      "list.highlightForeground",
      "editorLink.activeForeground",
      "focusBorder",
      "tab.activeBorder",
      "statusBarItem.remoteBackground",
    ],
    mix(foreground, background, 0.55),
  );

  const elevated = take(
    [
      "editorWidget.background",
      "dropdown.background",
      "menu.background",
      "quickInput.background",
      "editorSuggestWidget.background",
    ],
    mix(background, foreground, dark ? 0.08 : 0.05),
  );

  const card = take(
    ["sideBarSectionHeader.background", "tab.inactiveBackground", "editorGroupHeader.tabsBackground"],
    mix(background, foreground, dark ? 0.04 : 0.025),
  );

  const sidebar = take(
    ["sideBar.background", "activityBar.background"],
    mix(background, foreground, dark ? 0.02 : 0.012),
  );

  const accent = ensureContrast(accentSource, sidebar, ACCENT_MIN_CONTRAST);

  const border = take(
    [
      "panel.border",
      "editorGroup.border",
      "sideBar.border",
      "contrastBorder",
      "widget.border",
      "input.border",
    ],
    mix(background, foreground, dark ? 0.16 : 0.14),
  );

  const input = take(
    ["input.background", "dropdown.background", "quickInput.background"],
    mix(background, foreground, dark ? 0.1 : 0.06),
  );

  const mutedForeground = take(
    ["descriptionForeground", "editorLineNumber.foreground", "tab.inactiveForeground", "disabledForeground"],
    mix(foreground, background, 0.45),
  );

  const destructive = take(
    [
      "editorError.foreground",
      "errorForeground",
      "editorOverviewRuler.errorForeground",
      "notificationsErrorIcon.foreground",
    ],
    "#e25563",
  );

  const muted = mix(background, foreground, dark ? 0.06 : 0.04);
  const accentSoft = mix(accent, background, dark ? 0.82 : 0.88);
  const secondary = mix(accent, background, dark ? 0.72 : 0.86);

  const palette: SkinColors = {
    background,
    foreground,
    card,
    cardForeground: foreground,
    muted,
    mutedForeground,
    popover: elevated,
    popoverForeground: foreground,
    primary: accent,
    primaryForeground: readableOn(accent),
    secondary,
    secondaryForeground: foreground,
    accent: accentSoft,
    accentForeground: foreground,
    border,
    input,
    ring: accent,
    midground: accent,
    destructive,
    destructiveForeground: readableOn(destructive),
    sidebarBackground: sidebar,
    sidebarBorder: border,
  };

  const label = (opts.label ?? raw.name ?? "VS Code Theme").trim();
  const slug = opts.slug ?? vscodeThemeSlug(label);

  return {
    derived,
    mode: dark ? "dark" : "light",
    theme: {
      name: slug,
      label,
      description: opts.source ? `VS Code · ${opts.source}` : "Imported from VS Code",
      colors: palette,
      darkColors: palette,
    },
  };
}

/** Heuristic: does this JSON look like a VS Code color theme? */
export function looksLikeVscodeTheme(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const raw = parseVscodeTheme(trimmed);
    return Boolean(raw.colors && typeof raw.colors === "object");
  } catch {
    return false;
  }
}