import { APP_VERSION } from "@/lib/app-meta";
import type { DesktopUpdateStatus } from "@/lib/desktop-update-types";

const UNLOCKED_KEY = "forge:dev-unlocked";
const VERSION_CLICKS_KEY = "forge:dev-about-version-clicks";
const PREVIEW_UPDATE_ICON_KEY = "forge:dev-preview-update-icon";
const SHOW_CRONALYTICS_KEY = "forge:dev-show-cronalytics";
const SHOW_DECISIONS_KEY = "forge:dev-show-decisions";

const UNLOCK_CLICKS_REQUIRED = 5;

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota errors */
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isDeveloperUnlocked(): boolean {
  return readStorage(UNLOCKED_KEY) === "1";
}

export function getVersionUnlockClickCount(): number {
  const raw = readStorage(VERSION_CLICKS_KEY);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function recordVersionUnlockClick(): {
  count: number;
  justUnlocked: boolean;
} {
  if (isDeveloperUnlocked()) {
    return { count: UNLOCK_CLICKS_REQUIRED, justUnlocked: false };
  }

  const count = Math.min(UNLOCK_CLICKS_REQUIRED, getVersionUnlockClickCount() + 1);
  writeStorage(VERSION_CLICKS_KEY, String(count));

  if (count >= UNLOCK_CLICKS_REQUIRED) {
    writeStorage(UNLOCKED_KEY, "1");
    removeStorage(VERSION_CLICKS_KEY);
    return { count, justUnlocked: true };
  }

  return { count, justUnlocked: false };
}

export function getPreviewUpdateIcon(): boolean {
  return readStorage(PREVIEW_UPDATE_ICON_KEY) === "1";
}

export function setPreviewUpdateIcon(enabled: boolean) {
  if (enabled) {
    writeStorage(PREVIEW_UPDATE_ICON_KEY, "1");
  } else {
    removeStorage(PREVIEW_UPDATE_ICON_KEY);
  }
}

export function getShowCronalyticsPage(): boolean {
  return readStorage(SHOW_CRONALYTICS_KEY) === "1";
}

export function setShowCronalyticsPage(enabled: boolean) {
  if (enabled) {
    writeStorage(SHOW_CRONALYTICS_KEY, "1");
  } else {
    removeStorage(SHOW_CRONALYTICS_KEY);
  }
}

export function getShowDecisionsPage(): boolean {
  return readStorage(SHOW_DECISIONS_KEY) === "1";
}

export function setShowDecisionsPage(enabled: boolean) {
  if (enabled) {
    writeStorage(SHOW_DECISIONS_KEY, "1");
  } else {
    removeStorage(SHOW_DECISIONS_KEY);
  }
}

export function getPreviewUpdateStatus(): DesktopUpdateStatus {
  return {
    phase: "available",
    currentVersion: APP_VERSION,
    version: "9.9.9-dev",
    releaseNotes: "Developer preview — mock update for UI testing.",
    progress: null,
    error: null,
  };
}