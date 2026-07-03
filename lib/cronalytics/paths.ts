/**
 * Cronalytics — Hermes home resolution.
 *
 * Mirrors cronalytics/config.py from the original plugin. Looks for the
 * Hermes Agent installation directory in this order:
 *
 *   1. process.env.HERMES_HOME (explicit override)
 *   2. ~/.hermes (POSIX-style, what Hermes itself defaults to in `.env`)
 *   3. Platform-native fallback (LOCALAPPDATA\hermes on Windows, etc.)
 *
 * Once we have the home, everything else is fixed: state.db, cron/jobs.json,
 * profiles/<name>/state.db.
 */
import os from "os";
import path from "path";
import fs from "fs";

const isWindows = process.platform === "win32";

/** Hermes Agent installation root. */
export function getHermesHome(): string {
  const envHome = process.env.HERMES_HOME;
  if (envHome && fs.existsSync(envHome)) return envHome;

  const tildeHome = path.join(os.homedir(), ".hermes");
  if (fs.existsSync(tildeHome)) return tildeHome;

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const candidate = path.join(localAppData, "hermes");
      if (fs.existsSync(candidate)) return candidate;
    }
  } else if (process.platform === "darwin") {
    const candidate = path.join(os.homedir(), "Library", "Application Support", "hermes");
    if (fs.existsSync(candidate)) return candidate;
  } else {
    const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
    const candidate = path.join(xdg, "hermes");
    if (fs.existsSync(candidate)) return candidate;
  }

  // Last resort: return the env override or POSIX default even if missing —
  // callers will surface a clear "Hermes not found" error.
  return envHome || tildeHome;
}

/** Path to Hermes's main SQLite state DB. Read-only for us. */
export function getStateDbPath(home = getHermesHome()): string {
  return path.join(home, "state.db");
}

/** Path to cron/jobs.json. */
export function getJobsJsonPath(home = getHermesHome()): string {
  return path.join(home, "cron", "jobs.json");
}

/**
 * Per-profile state.db path (Hermes stores each profile's sessions in its
 * own state.db). We use the active profile (Hermes active_profile config) by
 * default; for the v1 port we just read the top-level state.db to match
 * Cronalytics' behaviour.
 */
export function getProfileStateDbPath(profile: string, home = getHermesHome()): string {
  return path.join(home, "profiles", profile, "state.db");
}

/** Path to our derived fact DB. Lives inside the project, gitignored. */
export function getFactDbPath(): string {
  return path.join(process.cwd(), "data", "cronalytics-facts.db");
}

/** Where we persist the sync watermark. */
export function getWatermarkPath(): string {
  return path.join(process.cwd(), "data", "cronalytics-watermark.json");
}

/** Probe for whether the Hermes install is reachable from this app. */
export interface HermesProbe {
  ok: boolean;
  home: string;
  stateDb: string;
  jobsJson: string;
  error?: string;
}

export function probeHermes(): HermesProbe {
  const home = getHermesHome();
  const stateDb = getStateDbPath(home);
  const jobsJson = getJobsJsonPath(home);

  if (!fs.existsSync(stateDb)) {
    return {
      ok: false,
      home,
      stateDb,
      jobsJson,
      error: `Hermes state.db not found at ${stateDb}. Set HERMES_HOME if Hermes is installed elsewhere.`,
    };
  }
  return { ok: true, home, stateDb, jobsJson };
}
