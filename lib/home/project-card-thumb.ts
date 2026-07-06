import type { CSSProperties } from "react";
import { hexToHsl, hslToHex, readableOn } from "@/lib/themes/color";
import { resolveSkinPalette } from "@/lib/themes/presets";
import type { ForgeSkin, SkinColors } from "@/lib/themes/types";

interface ThumbGradientSpec {
  hue: number;
  hueShiftRange: number;
  hueStep: number;
  saturation: number;
  lightnessFrom: number;
  lightnessTo: number;
  lightnessJitter?: number;
}

function hashToUnit(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

/** Pick the most chromatic accent from the active skin palette. */
function chromaticAnchor(palette: SkinColors): string {
  const candidates = [palette.primary, palette.ring, palette.midground].filter(
    (color): color is string => Boolean(color),
  );

  for (const color of candidates) {
    const hsl = hexToHsl(color);
    if (hsl && hsl.s >= 15) return color;
  }

  return palette.ring || palette.midground || palette.primary;
}

function defaultThumbSpec(anchor: string, name: string, mode: "light" | "dark"): ThumbGradientSpec {
  const base = hexToHsl(anchor) ?? { h: 24, s: 42, l: 40 };
  const achromatic = base.s < 12;

  // Shipped desktop default: hash-driven hues at ~40% lightness (see RecentProjectsStrip).
  if (achromatic) {
    return {
      hue: hashToUnit(name) % 360,
      hueShiftRange: 0,
      hueStep: 42,
      saturation: 42,
      lightnessFrom: 40,
      lightnessTo: 32,
      lightnessJitter: 0,
    };
  }

  return {
    hue: base.h,
    hueShiftRange: 40,
    hueStep: 42,
    saturation:
      mode === "light"
        ? Math.min(55, Math.max(40, base.s * 0.9 + 8))
        : Math.min(48, Math.max(32, base.s * 0.8)),
    lightnessFrom: mode === "light" ? 40 : 36,
    lightnessTo: mode === "light" ? 32 : 28,
    lightnessJitter: 0,
  };
}

/** Per-skin thumb tuning where the generic anchor logic misses the intended look. */
function skinThumbSpec(skinName: string, mode: "light" | "dark"): ThumbGradientSpec | null {
  if (skinName === "nous" && mode === "light") {
    return {
      hue: 222,
      hueShiftRange: 6,
      hueStep: 8,
      saturation: 100,
      lightnessFrom: 87,
      lightnessTo: 75,
    };
  }

  // Mono keeps the shipped per-name color accents — achromatic skin, chromatic thumbs.
  if (skinName === "mono") {
    return null;
  }

  if (skinName === "slate") {
    return {
      hue: 210,
      hueShiftRange: 6,
      hueStep: 10,
      saturation: 8,
      lightnessFrom: mode === "light" ? 44 : 40,
      lightnessTo: mode === "light" ? 34 : 30,
    };
  }

  return null;
}

function buildThumbGradient(name: string, spec: ThumbGradientSpec): { from: string; to: string } {
  const unit = hashToUnit(name);
  const hueShift = spec.hueShiftRange === 0 ? 0 : (unit % (spec.hueShiftRange * 2 + 1)) - spec.hueShiftRange;
  const lightnessJitter =
    spec.lightnessJitter && spec.lightnessJitter > 0
      ? (unit % (spec.lightnessJitter * 2 + 1)) - spec.lightnessJitter
      : 0;

  const hue1 = (spec.hue + hueShift + 360) % 360;
  const hue2 = spec.hueStep === 0 ? hue1 : (hue1 + spec.hueStep) % 360;

  const from = hslToHex(hue1, spec.saturation, spec.lightnessFrom + lightnessJitter);
  const to = hslToHex(
    hue2,
    spec.saturation * (spec.saturation === 0 ? 1 : 0.95),
    spec.lightnessTo,
  );

  return { from, to };
}

/**
 * Theme-aware gradient for recent-process card thumbs.
 * Each card keeps a distinct hue (from the process name) anchored to the active skin.
 */
export function getProjectCardThumbStyle(
  name: string,
  skin: ForgeSkin,
  mode: "light" | "dark",
): CSSProperties {
  const palette = resolveSkinPalette(skin, mode);
  // Shipped desktop: Mono and Nous dark used per-name hash hues, not skin anchor color.
  const shippedThumbs = skin.name === "mono" || (skin.name === "nous" && mode === "dark");
  const anchor = shippedThumbs ? "#808080" : chromaticAnchor(palette);
  const spec = skinThumbSpec(skin.name, mode) ?? defaultThumbSpec(anchor, name, mode);
  const { from, to } = buildThumbGradient(name, spec);
  const labelColor = readableOn(from);

  return {
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    color: labelColor,
    ["--project-card-thumb-shadow" as string]:
      labelColor === "#ffffff" ? "0 1px 2px rgba(0, 0, 0, 0.25)" : "none",
  };
}