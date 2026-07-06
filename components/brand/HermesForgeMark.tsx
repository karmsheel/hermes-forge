"use client";

import type { CSSProperties } from "react";
import steampunkGirl from "@/assets/girl_steampunk.svg";

const markArtUrl = typeof steampunkGirl === "string" ? steampunkGirl : steampunkGirl.src;

type HermesForgeMarkProps = {
  className?: string;
};

export function HermesForgeMark({ className }: HermesForgeMarkProps) {
  const mask = `url("${markArtUrl}")`;

  return (
    <div
      className={className}
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