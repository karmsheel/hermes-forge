import type { CSSProperties } from "react";
import { mix } from "@/lib/themes/color";
import { resolveSkinPalette } from "@/lib/themes/presets";
import type { ForgeSkin, SkinColors } from "@/lib/themes/types";

const CARD_ART_GLOW_PX = 3;

function hashToUnit(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

/** Neutral card-body gradient derived from the active skin palette. */
function subtleCardGradientStops(palette: SkinColors): { from: string; to: string } {
  const from = mix(palette.background, palette.card, 0.68);
  const to = mix(palette.card, palette.muted, 0.42);
  return { from, to };
}

function cardArtGlowColor(seed: string, palette: SkinColors): string {
  const unit = hashToUnit(seed);
  const accent = palette.midground ?? palette.ring ?? palette.primary;
  const highlight = palette.secondaryForeground ?? palette.accentForeground ?? accent;
  const blend = 0.22 + (unit % 5) * 0.05;
  return mix(accent, highlight, blend);
}

/** Subtle surface gradient with a 3px accent glow along the top edge only. */
function buildSubtleCardArtBackground(seed: string, palette: SkinColors): string {
  const unit = hashToUnit(seed);
  const jitter = (unit % 3) - 1;
  const { from: baseFrom, to: baseTo } = subtleCardGradientStops(palette);
  const from = mix(baseFrom, baseTo, jitter > 0 ? 0.08 : 0);
  const to = mix(baseTo, baseFrom, jitter < 0 ? 0.06 : 0);
  const glowColor = cardArtGlowColor(seed, palette);

  return [
    `linear-gradient(180deg, color-mix(in srgb, ${glowColor} 70%, transparent) 0px, color-mix(in srgb, ${glowColor} 22%, transparent) ${CARD_ART_GLOW_PX}px, transparent ${CARD_ART_GLOW_PX + 1}px)`,
    `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
  ].join(", ");
}

function getSubtleCardArtStyle(seed: string, skin: ForgeSkin, mode: "light" | "dark"): CSSProperties {
  const palette = resolveSkinPalette(skin, mode);

  return {
    background: buildSubtleCardArtBackground(seed, palette),
    color: palette.mutedForeground,
    ["--project-card-thumb-shadow" as string]: "none",
  };
}

/** Theme-aware art for card thumbs (e.g. business tiles). */
export function getProjectCardThumbStyle(
  name: string,
  skin: ForgeSkin,
  mode: "light" | "dark",
): CSSProperties {
  return getSubtleCardArtStyle(name, skin, mode);
}