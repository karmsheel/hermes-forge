/** Color helpers ported from Hermes Desktop `apps/desktop/src/themes/color.ts`. */

export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
}

export const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b]
    .map((n) =>
      Math.round(Math.min(255, Math.max(0, n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

export function mix(a: string, b: string, amount: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  if (!ar || !br) return a;
  return rgbToHex([
    ar[0] + (br[0] - ar[0]) * amount,
    ar[1] + (br[1] - ar[1]) * amount,
    ar[2] + (br[2] - ar[2]) * amount,
  ]);
}

const linearize = (channel: number): number =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG relative luminance (gamma-corrected), 0..1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => linearize(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Naive luminance for light/dark bucketing (VS Code import). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return la >= lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

export function readableOn(hex: string): string {
  return relativeLuminance(hex) > 0.58 ? "#161616" : "#ffffff";
}

export function ensureContrast(color: string, bg: string, min: number): string {
  if (contrastRatio(color, bg) >= min) return color;

  const towards = relativeLuminance(bg) < 0.5 ? "#ffffff" : "#000000";
  let best = color;

  for (let amount = 0.2; amount <= 1.0001; amount += 0.2) {
    best = mix(color, towards, Math.min(amount, 1));
    if (contrastRatio(best, bg) >= min) return best;
  }

  return best;
}

export function isDarkBackground(hex: string): boolean {
  return relativeLuminance(hex) < 0.45;
}

/**
 * Coerce VS Code theme hex tokens into flat 6-digit `#rrggbb`,
 * compositing alpha over `backdrop`.
 */
export function normalizeHex(input: string | undefined | null, backdrop = "#000000"): string | null {
  if (typeof input !== "string") return null;

  let clean = input.trim().replace(/^#/, "");

  if (clean.length === 3 || clean.length === 4) {
    clean = clean
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }

  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(clean)) return null;

  const rgb = hexToRgb(`#${clean.slice(0, 6)}`);
  if (!rgb) return null;

  if (clean.length === 6) return rgbToHex(rgb);

  const alpha = parseInt(clean.slice(6, 8), 16) / 255;
  const base = hexToRgb(backdrop) ?? [0, 0, 0];

  return rgbToHex([
    base[0] + (rgb[0] - base[0]) * alpha,
    base[1] + (rgb[1] - base[1]) * alpha,
    base[2] + (rgb[2] - base[2]) * alpha,
  ]);
}