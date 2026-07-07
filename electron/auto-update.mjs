import { BrowserWindow, ipcMain } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

/** @type {import("electron").App} */
let appRef = null;

/** @type {() => import("electron").BrowserWindow | null} */
let getMainWindow = () => null;

/** @type {import("../lib/desktop-update-types").DesktopUpdateStatus} */
let currentStatus = {
  phase: "idle",
  currentVersion: "0.0.0",
  version: null,
  releaseNotes: null,
  progress: null,
  error: null,
};

function broadcastStatus() {
  const payload = { ...currentStatus };
  const win = getMainWindow();
  const targets = win ? [win] : BrowserWindow.getAllWindows();
  for (const target of targets) {
    if (!target.isDestroyed()) {
      target.webContents.send("update:status", payload);
    }
  }
}

function setStatus(patch) {
  currentStatus = { ...currentStatus, ...patch };
  broadcastStatus();
}

function normalizeReleaseNotes(notes) {
  if (typeof notes === "string") return notes.trim() || null;
  if (Array.isArray(notes)) {
    const text = notes
      .map((entry) => (typeof entry === "string" ? entry : entry?.note))
      .filter(Boolean)
      .join("\n\n");
    return text.trim() || null;
  }
  return null;
}

function registerUpdateIpc() {
  ipcMain.handle("update:get-status", () => ({ ...currentStatus }));

  ipcMain.handle("update:check", async () => {
    if (!appRef?.isPackaged) return { ...currentStatus };
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      setStatus({
        phase: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { ...currentStatus };
  });

  ipcMain.handle("update:download", async () => {
    if (!appRef?.isPackaged) return { ...currentStatus };
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      setStatus({
        phase: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { ...currentStatus };
  });

  ipcMain.handle("update:install", () => {
    if (!appRef?.isPackaged) return;
    autoUpdater.quitAndInstall();
  });
}

export function setupAutoUpdate(app, getWindow) {
  appRef = app;
  getMainWindow = getWindow;
  currentStatus = {
    ...currentStatus,
    currentVersion: app.getVersion(),
  };

  registerUpdateIpc();

  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...args) => console.log("[auto-update]", ...args),
    warn: (...args) => console.warn("[auto-update]", ...args),
    error: (...args) => console.error("[auto-update]", ...args),
    debug: (...args) => console.log("[auto-update]", ...args),
  };

  autoUpdater.on("checking-for-update", () => {
    setStatus({ phase: "checking", error: null });
  });

  autoUpdater.on("update-available", (info) => {
    setStatus({
      phase: "available",
      version: info.version ?? null,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      error: null,
      progress: null,
    });
  });

  autoUpdater.on("update-not-available", () => {
    setStatus({ phase: "not-available", error: null });
  });

  autoUpdater.on("error", (error) => {
    setStatus({
      phase: "error",
      error: error?.message || String(error),
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setStatus({
      phase: "downloading",
      progress: {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      },
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setStatus({
      phase: "downloaded",
      version: info.version ?? currentStatus.version,
      progress: null,
      error: null,
    });
  });
}

const SKIP_RECHECK_PHASES = new Set(["checking", "available", "downloading", "downloaded"]);

/** @type {ReturnType<typeof setInterval> | null} */
let periodicTimer = null;

async function runUpdateCheck() {
  if (!appRef?.isPackaged) return;
  if (SKIP_RECHECK_PHASES.has(currentStatus.phase)) return;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("[auto-update] check failed", error);
    setStatus({
      phase: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function scheduleUpdateCheck(delayMs = 8000) {
  if (!appRef?.isPackaged) return;
  setTimeout(() => void runUpdateCheck(), delayMs);
}

/** Re-poll GitHub so users see updates after a draft release is published. */
export function schedulePeriodicUpdateChecks(intervalMs = 30 * 60 * 1000) {
  if (!appRef?.isPackaged) return;
  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => void runUpdateCheck(), intervalMs);
}

export function checkForUpdatesOnFocus() {
  void runUpdateCheck();
}