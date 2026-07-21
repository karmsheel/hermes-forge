"use client";

import type { CSSProperties } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import nousMarkArt from "@/assets/girl_nous.png";
import steampunkGirl from "@/assets/girl_steampunk.svg";

/** Mask-friendly SVG — recolors via theme accent (default non-Nous marks + chat tab). */
const steampunkMarkArtUrl =
  typeof steampunkGirl === "string" ? steampunkGirl : steampunkGirl.src;
/** Full-color cutout — thin outline (hero, BM) on Nous only. */
const nousMarkArtUrl = typeof nousMarkArt === "string" ? nousMarkArt : nousMarkArt.src;

type HermesForgeMarkProps = {
  className?: string;
  /**
   * `tab` — steampunk SVG mask + CSS white outline (all themes).
   * `default` — Nous full-color cutout, else steampunk SVG mask.
   */
  variant?: "default" | "tab";
};

/**
 * Shared brand mark (chatbar collapsed tab).
 */
export function HermesForgeMark({ className, variant = "default" }: HermesForgeMarkProps) {
  const { skinName } = useTheme();

  // Chat tab: steampunk SVG mask, theme-tinted on every skin.
  if (variant === "tab") {
    const classes = [className, "hermes-forge-mark--tab"].filter(Boolean).join(" ");
    const mask = `url("${steampunkMarkArtUrl}")`;
    return (
      <div
        className={classes}
        aria-hidden
        style={
          {
            WebkitMaskImage: mask,
            maskImage: mask,
          } as CSSProperties
        }
      />
    );
  }

  // Default mark: full-color on Nous, mask SVG elsewhere.
  const useNousMark = skinName === "nous";
  const classes = [className, useNousMark ? "hermes-forge-mark--raster" : ""]
    .filter(Boolean)
    .join(" ");

  if (useNousMark) {
    return (
      <div
        className={classes}
        aria-hidden
        style={
          {
            "--hermes-forge-mark-url": `url("${nousMarkArtUrl}")`,
          } as CSSProperties
        }
      />
    );
  }

  const mask = `url("${steampunkMarkArtUrl}")`;

  return (
    <div
      className={classes}
      aria-hidden
      style={
        {
          WebkitMaskImage: mask,
          maskImage: mask,
        } as CSSProperties
      }
    />
  );
}
