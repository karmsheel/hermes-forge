/**
 * Global chatbar panel residency (PR-1 / 4.17).
 * Mirrors extension open-vs-collapsed residency without browser tab attachment.
 */

export const CHATBAR_RESIDENCY_MODES = Object.freeze({
  OPEN: "open",
  COLLAPSED: "collapsed",
} as const);

export type ChatbarResidency = (typeof CHATBAR_RESIDENCY_MODES)[keyof typeof CHATBAR_RESIDENCY_MODES];

export const CHATBAR_RESIDENCY_STORAGE_KEY = "forge.chatbar.residency";

/** First-run default so the elevated dock is discoverable. */
export const DEFAULT_CHATBAR_RESIDENCY: ChatbarResidency = CHATBAR_RESIDENCY_MODES.OPEN;

export function normalizeChatbarResidency(value: unknown): ChatbarResidency {
  if (value === CHATBAR_RESIDENCY_MODES.COLLAPSED) return CHATBAR_RESIDENCY_MODES.COLLAPSED;
  if (value === CHATBAR_RESIDENCY_MODES.OPEN) return CHATBAR_RESIDENCY_MODES.OPEN;
  return DEFAULT_CHATBAR_RESIDENCY;
}

export function loadChatbarResidency(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
): ChatbarResidency {
  if (!storage) return DEFAULT_CHATBAR_RESIDENCY;
  try {
    return normalizeChatbarResidency(storage.getItem(CHATBAR_RESIDENCY_STORAGE_KEY));
  } catch {
    return DEFAULT_CHATBAR_RESIDENCY;
  }
}

export function saveChatbarResidency(
  residency: ChatbarResidency,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHATBAR_RESIDENCY_STORAGE_KEY, normalizeChatbarResidency(residency));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function toggleChatbarResidency(current: ChatbarResidency): ChatbarResidency {
  return normalizeChatbarResidency(current) === CHATBAR_RESIDENCY_MODES.OPEN
    ? CHATBAR_RESIDENCY_MODES.COLLAPSED
    : CHATBAR_RESIDENCY_MODES.OPEN;
}

/** Dock side of the main content area (nav rail stays outermost left). */
export const CHATBAR_SIDES = Object.freeze({
  RIGHT: "right",
  LEFT: "left",
} as const);

export type ChatbarSide = (typeof CHATBAR_SIDES)[keyof typeof CHATBAR_SIDES];

export const CHATBAR_SIDE_STORAGE_KEY = "forge.chatbar.side";

export const DEFAULT_CHATBAR_SIDE: ChatbarSide = CHATBAR_SIDES.RIGHT;

export function normalizeChatbarSide(value: unknown): ChatbarSide {
  if (value === CHATBAR_SIDES.LEFT) return CHATBAR_SIDES.LEFT;
  if (value === CHATBAR_SIDES.RIGHT) return CHATBAR_SIDES.RIGHT;
  return DEFAULT_CHATBAR_SIDE;
}

export function loadChatbarSide(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
): ChatbarSide {
  if (!storage) return DEFAULT_CHATBAR_SIDE;
  try {
    return normalizeChatbarSide(storage.getItem(CHATBAR_SIDE_STORAGE_KEY));
  } catch {
    return DEFAULT_CHATBAR_SIDE;
  }
}

export function saveChatbarSide(
  side: ChatbarSide,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHATBAR_SIDE_STORAGE_KEY, normalizeChatbarSide(side));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function toggleChatbarSide(current: ChatbarSide): ChatbarSide {
  return normalizeChatbarSide(current) === CHATBAR_SIDES.LEFT
    ? CHATBAR_SIDES.RIGHT
    : CHATBAR_SIDES.LEFT;
}

// —— Collapsed tab vertical edge placement ——

/** Named vertical presets for the collapsed restore tab. */
export const CHATBAR_EDGE_ALIGNS = Object.freeze({
  TOP: "top",
  MIDDLE: "middle",
  BOTTOM: "bottom",
  CUSTOM: "custom",
} as const);

export type ChatbarEdgeAlign =
  (typeof CHATBAR_EDGE_ALIGNS)[keyof typeof CHATBAR_EDGE_ALIGNS];

export const CHATBAR_EDGE_OFFSET_STORAGE_KEY = "forge.chatbar.edgeOffset";
export const CHATBAR_EDGE_ALIGN_STORAGE_KEY = "forge.chatbar.edgeAlign";

/** Fraction of usable edge height (0 = top of range, 1 = bottom). Middle matches historical CSS. */
export const DEFAULT_CHATBAR_EDGE_OFFSET = 0.5;
export const DEFAULT_CHATBAR_EDGE_ALIGN: ChatbarEdgeAlign = CHATBAR_EDGE_ALIGNS.MIDDLE;

/** Preset offsets (relative to usable vertical range after safe insets). */
export const CHATBAR_EDGE_PRESET_OFFSETS = Object.freeze({
  top: 0.12,
  middle: 0.5,
  bottom: 0.88,
} as const);

/** Magnetic snap radius as a fraction of the usable range (≈8%). */
export const CHATBAR_EDGE_SNAP_THRESHOLD = 0.08;

/** Same-tab broadcast when prefs change outside ChatbarProvider (e.g. Settings). */
export const CHATBAR_PREFS_CHANGED_EVENT = "forge:chatbar-prefs-changed";

export function notifyChatbarPrefsChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(CHATBAR_PREFS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function normalizeChatbarEdgeOffset(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return DEFAULT_CHATBAR_EDGE_OFFSET;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function normalizeChatbarEdgeAlign(value: unknown): ChatbarEdgeAlign {
  if (value === CHATBAR_EDGE_ALIGNS.TOP) return CHATBAR_EDGE_ALIGNS.TOP;
  if (value === CHATBAR_EDGE_ALIGNS.MIDDLE) return CHATBAR_EDGE_ALIGNS.MIDDLE;
  if (value === CHATBAR_EDGE_ALIGNS.BOTTOM) return CHATBAR_EDGE_ALIGNS.BOTTOM;
  if (value === CHATBAR_EDGE_ALIGNS.CUSTOM) return CHATBAR_EDGE_ALIGNS.CUSTOM;
  return DEFAULT_CHATBAR_EDGE_ALIGN;
}

export function offsetForEdgeAlign(align: ChatbarEdgeAlign, customOffset?: number): number {
  const a = normalizeChatbarEdgeAlign(align);
  if (a === CHATBAR_EDGE_ALIGNS.TOP) return CHATBAR_EDGE_PRESET_OFFSETS.top;
  if (a === CHATBAR_EDGE_ALIGNS.BOTTOM) return CHATBAR_EDGE_PRESET_OFFSETS.bottom;
  if (a === CHATBAR_EDGE_ALIGNS.CUSTOM) {
    return normalizeChatbarEdgeOffset(
      customOffset === undefined ? DEFAULT_CHATBAR_EDGE_OFFSET : customOffset,
    );
  }
  return CHATBAR_EDGE_PRESET_OFFSETS.middle;
}

/**
 * Snap a free offset to the nearest named preset when within threshold.
 * Returns custom + original offset when far from all presets.
 */
export function snapEdgeOffset(
  offset: number,
  threshold: number = CHATBAR_EDGE_SNAP_THRESHOLD,
): { align: ChatbarEdgeAlign; offset: number } {
  const o = normalizeChatbarEdgeOffset(offset);
  const candidates: { align: Exclude<ChatbarEdgeAlign, "custom">; offset: number }[] = [
    { align: CHATBAR_EDGE_ALIGNS.TOP, offset: CHATBAR_EDGE_PRESET_OFFSETS.top },
    { align: CHATBAR_EDGE_ALIGNS.MIDDLE, offset: CHATBAR_EDGE_PRESET_OFFSETS.middle },
    { align: CHATBAR_EDGE_ALIGNS.BOTTOM, offset: CHATBAR_EDGE_PRESET_OFFSETS.bottom },
  ];
  let best = candidates[0];
  let bestDist = Math.abs(o - best.offset);
  for (const c of candidates.slice(1)) {
    const d = Math.abs(o - c.offset);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  if (bestDist <= threshold) {
    return { align: best.align, offset: best.offset };
  }
  return { align: CHATBAR_EDGE_ALIGNS.CUSTOM, offset: o };
}

export function loadChatbarEdgeOffset(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window !== "undefined"
    ? window.localStorage
    : null,
): number {
  if (!storage) return DEFAULT_CHATBAR_EDGE_OFFSET;
  try {
    return normalizeChatbarEdgeOffset(storage.getItem(CHATBAR_EDGE_OFFSET_STORAGE_KEY));
  } catch {
    return DEFAULT_CHATBAR_EDGE_OFFSET;
  }
}

export function saveChatbarEdgeOffset(
  offset: number,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window !== "undefined"
    ? window.localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHATBAR_EDGE_OFFSET_STORAGE_KEY, String(normalizeChatbarEdgeOffset(offset)));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function loadChatbarEdgeAlign(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window !== "undefined"
    ? window.localStorage
    : null,
): ChatbarEdgeAlign {
  if (!storage) return DEFAULT_CHATBAR_EDGE_ALIGN;
  try {
    return normalizeChatbarEdgeAlign(storage.getItem(CHATBAR_EDGE_ALIGN_STORAGE_KEY));
  } catch {
    return DEFAULT_CHATBAR_EDGE_ALIGN;
  }
}

export function saveChatbarEdgeAlign(
  align: ChatbarEdgeAlign,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window !== "undefined"
    ? window.localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHATBAR_EDGE_ALIGN_STORAGE_KEY, normalizeChatbarEdgeAlign(align));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Default vertical safe insets for the collapsed edge tab (title bar / OS chrome). */
export const CHATBAR_EDGE_SAFE_TOP = 48;
export const CHATBAR_EDGE_SAFE_BOTTOM = 24;

/**
 * CSS `top` (px) for the collapsed tab center point.
 * Usable range is [safeTop, viewportHeight - safeBottom]; offset 0..1 maps within that range.
 */
export function edgeOffsetToTopPx(
  offset: number,
  viewportHeight: number,
  safeTop: number = CHATBAR_EDGE_SAFE_TOP,
  safeBottom: number = CHATBAR_EDGE_SAFE_BOTTOM,
): number {
  const o = normalizeChatbarEdgeOffset(offset);
  const vh = Math.max(0, viewportHeight);
  const top = Math.max(0, safeTop);
  const bottom = Math.max(0, safeBottom);
  const usable = Math.max(0, vh - top - bottom);
  if (usable <= 0) return vh / 2;
  return top + o * usable;
}

/**
 * Inverse of {@link edgeOffsetToTopPx}: map a viewport Y (tab center) to 0..1 edge offset.
 */
export function topPxToEdgeOffset(
  topPx: number,
  viewportHeight: number,
  safeTop: number = CHATBAR_EDGE_SAFE_TOP,
  safeBottom: number = CHATBAR_EDGE_SAFE_BOTTOM,
): number {
  const vh = Math.max(0, viewportHeight);
  const top = Math.max(0, safeTop);
  const bottom = Math.max(0, safeBottom);
  const usable = Math.max(0, vh - top - bottom);
  if (usable <= 0) return DEFAULT_CHATBAR_EDGE_OFFSET;
  const y = typeof topPx === "number" && Number.isFinite(topPx) ? topPx : top + usable / 2;
  return normalizeChatbarEdgeOffset((y - top) / usable);
}
