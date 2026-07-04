import { isDarkBackground, mix } from "./color";
import { resolveSkinPalette } from "./presets";
import type { ForgeSkin, ForgeSkinVars, SkinColors } from "./types";

function pickHex(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (c && c.startsWith("#")) return c;
  }
  return "#000000";
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
  const borderStrong = mix(border, c.foreground, dark ? 0.35 : 0.22);
  const borderSoft = mix(border, bg, 0.45);
  const muted = pickHex(c.muted, c.secondary);
  const subtle = mix(muted, bg, 0.4);
  const selected = pickHex(c.ring, c.midground, "#2563eb");
  const destructive = c.destructive;

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
    "--text": c.foreground,
    "--text-strong": dark ? mix(c.foreground, "#ffffff", 0.12) : mix(c.foreground, "#000000", 0.15),
    "--text-muted": pickHex(c.mutedForeground, mix(c.foreground, bg, 0.45)),
    "--text-soft": mix(c.mutedForeground ?? c.foreground, bg, 0.55),
    "--text-faint": mix(c.mutedForeground ?? c.foreground, bg, 0.7),
    "--accent": primary,
    "--accent-strong": accentHover,
    "--accent-soft": accentSoft,
    "--accent-tint": accentTint,
    "--accent-hover": accentHover,
    "--selected": selected,
    "--selected-soft": `color-mix(in srgb, ${selected} 16%, transparent)`,
    "--red": destructive,
    "--red-bg": mix(destructive, bg, dark ? 0.82 : 0.9),
    "--red-border": mix(destructive, bg, dark ? 0.65 : 0.75),
  };

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
    vars["--green"] = "#1f7a3a";
    vars["--green-bg"] = "#e8f7ee";
    vars["--green-border"] = "#c6ead2";
    vars["--amber"] = "#b26200";
    vars["--amber-bg"] = "#fff3e0";
    vars["--blue"] = "#2348b8";
    vars["--blue-bg"] = "#e8efff";
    vars["--blue-border"] = "#c8d6ff";
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
    "--text",
    "--text-strong",
    "--text-muted",
    "--text-soft",
    "--text-faint",
    "--accent",
    "--accent-strong",
    "--accent-soft",
    "--accent-tint",
    "--accent-hover",
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