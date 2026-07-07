import { isDarkBackground, mix } from "./color";
import { BUILTIN_SKINS } from "./presets";
import type { ForgeSkin, SkinColors } from "./types";

const REQUIRED_COLOR_KEYS = ["background", "foreground", "primary"] as const;

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export type ThemeValidationResult =
  | { ok: true; theme: ForgeSkin }
  | { ok: false; error: string };

/** Turn a display label into a stable skin slug. */
export function slugifySkinName(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return "custom";
  return /^[0-9]/.test(slug) ? `skin-${slug}` : slug;
}

function hasRequiredColors(colors: unknown): colors is Partial<SkinColors> & Pick<SkinColors, "background" | "foreground" | "primary"> {
  if (!colors || typeof colors !== "object") return false;
  const record = colors as Record<string, unknown>;
  return REQUIRED_COLOR_KEYS.every((key) => typeof record[key] === "string" && record[key].length > 0);
}

/** Fill optional palette slots from the minimal required trio. */
export function normalizeSkinColors(
  partial: Partial<SkinColors> & Pick<SkinColors, "background" | "foreground" | "primary">,
): SkinColors {
  const { background, foreground, primary } = partial;
  const card = partial.card ?? partial.popover ?? background;

  return {
    background,
    foreground,
    primary,
    primaryForeground:
      partial.primaryForeground ?? (isDarkBackground(primary) ? "#ffffff" : "#1a1916"),
    card,
    cardForeground: partial.cardForeground ?? partial.popoverForeground ?? foreground,
    muted: partial.muted ?? partial.secondary ?? mix(foreground, background, 0.92),
    mutedForeground: partial.mutedForeground ?? mix(foreground, background, 0.55),
    popover: partial.popover ?? card,
    popoverForeground: partial.popoverForeground ?? foreground,
    secondary: partial.secondary ?? mix(primary, background, 0.88),
    secondaryForeground: partial.secondaryForeground ?? foreground,
    accent: partial.accent ?? partial.secondary ?? mix(primary, background, 0.85),
    accentForeground: partial.accentForeground ?? foreground,
    border: partial.border ?? partial.input ?? mix(foreground, background, 0.82),
    input: partial.input ?? partial.border ?? mix(foreground, background, 0.82),
    ring: partial.ring ?? partial.midground ?? primary,
    midground: partial.midground ?? partial.ring ?? primary,
    destructive: partial.destructive ?? "#cf4848",
    destructiveForeground: partial.destructiveForeground ?? "#ffffff",
    sidebarBackground: partial.sidebarBackground ?? background,
    sidebarBorder: partial.sidebarBorder ?? partial.border ?? mix(foreground, background, 0.82),
    userBubble: partial.userBubble,
    userBubbleBorder: partial.userBubbleBorder,
    composerForeground: partial.composerForeground,
    composerPlaceholder: partial.composerPlaceholder,
    composerRing: partial.composerRing,
    midgroundForeground: partial.midgroundForeground,
  };
}

function normalizePalette(
  colors: Partial<SkinColors> & Pick<SkinColors, "background" | "foreground" | "primary">,
): SkinColors {
  return normalizeSkinColors(colors);
}

/** Parse and normalize a theme JSON payload (string or object). */
export function parseThemeInput(input: string | unknown): ThemeValidationResult {
  let raw: unknown = input;

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return { ok: false, error: "Paste a theme JSON object to install." };
    }
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: "Invalid JSON — check brackets, quotes, and commas." };
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Theme must be a JSON object." };
  }

  const record = raw as Record<string, unknown>;
  const themeBody =
    record.colors && typeof record.colors === "object"
      ? record
      : record.theme && typeof record.theme === "object"
        ? (record.theme as Record<string, unknown>)
        : null;

  if (!themeBody) {
    return { ok: false, error: "Missing a colors object with background, foreground, and primary." };
  }

  const label =
    typeof themeBody.label === "string" && themeBody.label.trim()
      ? themeBody.label.trim()
      : typeof themeBody.name === "string" && themeBody.name.trim()
        ? themeBody.name.trim()
        : "";

  if (!label) {
    return { ok: false, error: "Theme needs a label (or name) for the picker." };
  }

  const name =
    typeof themeBody.name === "string" && themeBody.name.trim()
      ? slugifySkinName(themeBody.name)
      : slugifySkinName(label);

  if (!SLUG_PATTERN.test(name)) {
    return { ok: false, error: "Theme name must be a lowercase slug (letters, numbers, hyphens)." };
  }

  if (BUILTIN_SKINS[name]) {
    return { ok: false, error: `"${name}" is reserved for a built-in skin — choose another name.` };
  }

  if (!hasRequiredColors(themeBody.colors)) {
    return { ok: false, error: "colors must include background, foreground, and primary strings." };
  }

  const colors = normalizePalette(themeBody.colors);
  const darkColors =
    themeBody.darkColors && hasRequiredColors(themeBody.darkColors)
      ? normalizePalette(themeBody.darkColors)
      : undefined;

  const description =
    typeof themeBody.description === "string" && themeBody.description.trim()
      ? themeBody.description.trim()
      : "Custom installed theme";

  const theme: ForgeSkin = {
    name,
    label,
    description,
    colors,
    ...(darkColors ? { darkColors } : {}),
  };

  return { ok: true, theme };
}