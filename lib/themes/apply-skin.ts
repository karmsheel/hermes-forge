import { hexToHsl, isDarkBackground, mix, readableOn } from "./color";
import { resolveSkinPalette } from "./presets";
import type { ForgeSkin, ForgeSkinVars, SkinColors } from "./types";

function pickHex(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (c && c.startsWith("#")) return c;
  }
  return "#000000";
}

function composerVars(
  c: SkinColors,
  border: string,
): Pick<
  ForgeSkinVars,
  | "--composer-bg"
  | "--composer-fg"
  | "--composer-fg-muted"
  | "--composer-fg-soft"
  | "--composer-fg-faint"
  | "--composer-border"
  | "--composer-border-soft"
  | "--composer-border-strong"
> {
  if (!c.userBubble) {
    return {
      "--composer-bg": "var(--bg-elevated)",
      "--composer-fg": "var(--text)",
      "--composer-fg-muted": "var(--text-muted)",
      "--composer-fg-soft": "var(--text-soft)",
      "--composer-fg-faint": "var(--text-faint)",
      "--composer-border": "var(--line)",
      "--composer-border-soft": "var(--border-soft)",
      "--composer-border-strong": "var(--border-strong)",
    };
  }

  const composerBg = c.userBubble;
  const composerBorder = pickHex(c.userBubbleBorder, border);
  const composerFg = "#ffffff";

  return {
    "--composer-bg": composerBg,
    "--composer-fg": composerFg,
    "--composer-fg-muted": mix(composerFg, composerBg, 0.35),
    "--composer-fg-soft": mix(composerFg, composerBg, 0.48),
    "--composer-fg-faint": mix(composerFg, composerBg, 0.62),
    "--composer-border": composerBorder,
    "--composer-border-soft": mix(composerBorder, composerBg, 0.55),
    "--composer-border-strong": mix(composerBorder, composerFg, 0.18),
  };
}

/** Ink used for lines, strokes, and shadows — follows skin line accent when set. */
function lineInk(c: SkinColors, dark: boolean): string {
  if (c.composerRing) return c.composerRing;
  if (dark) return "#000000";
  const hsl = hexToHsl(c.foreground);
  return hsl && hsl.s >= 10 ? c.foreground : "#1c1b1a";
}

function shadowVars(ink: string): Pick<
  ForgeSkinVars,
  "--shadow-xs" | "--shadow-sm" | "--shadow-md" | "--shadow-nous" | "--stroke-nous"
> {
  return {
    "--shadow-xs": `0 1px 0 color-mix(in srgb, ${ink} 4%, transparent)`,
    "--shadow-sm": `0 1px 2px color-mix(in srgb, ${ink} 5%, transparent), 0 1px 3px color-mix(in srgb, ${ink} 4%, transparent)`,
    "--shadow-md": `0 6px 24px color-mix(in srgb, ${ink} 7%, transparent), 0 2px 6px color-mix(in srgb, ${ink} 4%, transparent)`,
    "--shadow-nous": [
      `0 0.125rem 0.25rem -0.125rem color-mix(in srgb, ${ink} 7%, transparent)`,
      `0 0.5rem 0.75rem -0.375rem color-mix(in srgb, ${ink} 6%, transparent)`,
      `0 1.25rem 1.75rem -0.875rem color-mix(in srgb, ${ink} 6%, transparent)`,
      `0 2.25rem 3rem -1.75rem color-mix(in srgb, ${ink} 0%, transparent)`,
    ].join(", "),
    "--stroke-nous": `color-mix(in srgb, ${ink} 14%, transparent)`,
  };
}

/** Build Forge CSS custom properties from a skin palette. */
export function forgeVarsFromColors(c: SkinColors): ForgeSkinVars {
  const bg = c.background;
  const dark = isDarkBackground(bg);
  const panel = pickHex(c.sidebarBackground, c.card, c.background);
  const elevated = pickHex(c.card, c.popover, c.background);
  const primary = c.primary;
  const accentHover = pickHex(c.midground, c.ring, c.primary);
  const accentSoft = pickHex(c.secondary, c.accent, c.muted);
  const accentTint = mix(accentSoft, bg, dark ? 0.35 : 0.55);
  const border = pickHex(c.border, c.input);
  const borderStrongInk = pickHex(c.composerRing, c.foreground);
  const borderStrong = mix(border, borderStrongInk, dark ? 0.35 : 0.22);
  const structuralLine = c.composerRing
    ? mix(pickHex(c.composerRing), bg, dark ? 0.55 : 0.7)
    : border;
  const sidebarBorder = pickHex(c.sidebarBorder, structuralLine, border);
  const borderSoft = mix(border, bg, 0.45);
  const muted = pickHex(c.muted, c.secondary);
  const subtle = mix(muted, bg, 0.4);
  const selected = pickHex(c.ring, c.midground, "#2563eb");
  const destructive = c.destructive;
  const ink = lineInk(c, dark);
  const fgHsl = hexToHsl(c.foreground);
  const chromaticFg = Boolean(fgHsl && fgHsl.s >= 10);

  const vars: ForgeSkinVars = {
    "--bg": bg,
    "--bg-app": bg,
    "--bg-panel": panel,
    "--bg-subtle": subtle,
    "--bg-muted": muted,
    "--bg-elevated": elevated,
    "--border": border,
    "--border-strong": borderStrong,
    "--border-soft": borderSoft,
    "--line": structuralLine,
    "--sidebar-border": sidebarBorder,
    "--text": c.foreground,
    "--text-strong": dark
      ? mix(c.foreground, "#ffffff", 0.12)
      : chromaticFg
        ? c.foreground
        : mix(c.foreground, "#000000", 0.15),
    "--text-muted": pickHex(c.mutedForeground, mix(c.foreground, bg, 0.45)),
    "--text-soft": mix(c.mutedForeground ?? c.foreground, bg, 0.55),
    "--text-faint": mix(c.mutedForeground ?? c.foreground, bg, 0.7),
    "--accent": primary,
    "--accent-fg": c.primaryForeground,
    "--accent-strong": accentHover,
    "--accent-soft": accentSoft,
    "--accent-tint": accentTint,
    "--accent-hover": accentHover,
    "--accent-hover-fg": readableOn(accentHover),
    "--selected": selected,
    "--selected-soft": `color-mix(in srgb, ${selected} 16%, transparent)`,
    "--red": destructive,
    "--red-bg": mix(destructive, bg, dark ? 0.82 : 0.9),
    "--red-border": mix(destructive, bg, dark ? 0.65 : 0.75),
    ...composerVars(c, border),
  };

  // Dynamic shadows and fill tints only for skins with a line accent (Nous).
  // Other built-ins keep the static token shadows from tokens.css — the shipped look.
  if (c.composerRing) {
    vars["--bg-fill-tertiary"] = `color-mix(in srgb, ${ink} 3%, transparent)`;
    vars["--bg-fill-secondary"] = `color-mix(in srgb, ${ink} 6%, transparent)`;
    Object.assign(vars, shadowVars(ink));
  }

  if (dark) {
    vars["--green"] = "#4caf72";
    vars["--green-bg"] = "#0f2a18";
    vars["--green-border"] = "#1a4028";
    vars["--amber"] = "#e09a40";
    vars["--amber-bg"] = "#2a1a04";
    vars["--blue"] = "#6b8fe8";
    vars["--blue-bg"] = "#0f1a38";
    vars["--blue-border"] = "#1a2c58";
  } else {
    const blue = pickHex(c.midground, c.ring, c.primary, "#2348b8");
    const blueBg = pickHex(c.secondary, c.accent, c.muted, "#e8efff");
    vars["--green"] = "#1f7a3a";
    vars["--green-bg"] = "#e8f7ee";
    vars["--green-border"] = "#c6ead2";
    vars["--amber"] = "#b26200";
    vars["--amber-bg"] = "#fff3e0";
    vars["--blue"] = blue;
    vars["--blue-bg"] = blueBg;
    vars["--blue-border"] = mix(blue, c.background, 0.72);
  }

  return vars;
}

export function forgeVarsFromSkin(skin: ForgeSkin, mode: "light" | "dark"): ForgeSkinVars {
  return forgeVarsFromColors(resolveSkinPalette(skin, mode));
}

export function applySkinVars(
  vars: ForgeSkinVars,
  el: HTMLElement = document.documentElement,
): void {
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

export function clearSkinVars(el: HTMLElement = document.documentElement): void {
  const toRemove = [
    "--bg",
    "--bg-app",
    "--bg-panel",
    "--bg-subtle",
    "--bg-muted",
    "--bg-elevated",
    "--border",
    "--border-strong",
    "--border-soft",
    "--line",
    "--sidebar-border",
    "--text",
    "--text-strong",
    "--text-muted",
    "--text-soft",
    "--text-faint",
    "--accent",
    "--accent-fg",
    "--accent-strong",
    "--accent-soft",
    "--accent-tint",
    "--accent-hover",
    "--accent-hover-fg",
    "--selected",
    "--selected-soft",
    "--red",
    "--red-bg",
    "--red-border",
    "--green",
    "--green-bg",
    "--green-border",
    "--amber",
    "--amber-bg",
    "--blue",
    "--blue-bg",
    "--blue-border",
    "--bg-fill-tertiary",
    "--bg-fill-secondary",
    "--shadow-xs",
    "--shadow-sm",
    "--shadow-md",
    "--shadow-nous",
    "--stroke-nous",
    "--composer-bg",
    "--composer-fg",
    "--composer-fg-muted",
    "--composer-fg-soft",
    "--composer-fg-faint",
    "--composer-border",
    "--composer-border-soft",
    "--composer-border-strong",
  ];
  for (const key of toRemove) {
    el.style.removeProperty(key);
  }
}

export function applySkin(
  skin: ForgeSkin,
  mode: "light" | "dark",
  el: HTMLElement = document.documentElement,
): void {
  applySkinVars(forgeVarsFromSkin(skin, mode), el);
  el.setAttribute("data-skin", skin.name);
}