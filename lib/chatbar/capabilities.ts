/**
 * Hermes gateway capability helpers for the chatbar (4.17 PR-6).
 * Features arrive from probe as a string[] of enabled capability names.
 */

export type ChatbarCapabilities = {
  runStop: boolean;
  runSteer: boolean;
  models: boolean;
  sessions: boolean;
  raw: string[];
};

const STEER_NAMES = [
  "run_steer",
  "runSteer",
  "steer",
  "session_steer",
  "sessionSteer",
];

const STOP_NAMES = ["run_stop", "runStop", "stop"];

function hasAny(features: readonly string[], names: string[]): boolean {
  const set = new Set(features.map((f) => f.toLowerCase()));
  return names.some((n) => set.has(n.toLowerCase()));
}

/**
 * Normalize Hermes probe `features` into chatbar capability flags.
 * When features are missing/empty (legacy gateway), stop is assumed available
 * via AbortController; steer stays off until advertised.
 */
export function parseChatbarCapabilities(
  features: readonly string[] | null | undefined,
): ChatbarCapabilities {
  const raw = Array.isArray(features) ? features.filter(Boolean).map(String) : [];
  if (raw.length === 0) {
    return {
      runStop: true,
      runSteer: false,
      models: true,
      sessions: true,
      raw,
    };
  }

  return {
    runStop: hasAny(raw, STOP_NAMES) || true, // client abort always works
    runSteer: hasAny(raw, STEER_NAMES),
    models: hasAny(raw, ["models", "model_list", "modelList"]) || true,
    sessions: hasAny(raw, ["sessions", "session"]) || true,
    raw,
  };
}

export function canSteerFromFeatures(
  features: readonly string[] | null | undefined,
): boolean {
  return parseChatbarCapabilities(features).runSteer;
}

/**
 * POST steer text into an active Hermes run.
 * Best-effort multi-key body matches hermes-browser-extension.
 */
export async function steerActiveRun(opts: {
  baseUrl: string;
  apiKey?: string;
  runId: string;
  text: string;
  signal?: AbortSignal;
}): Promise<void> {
  const runId = String(opts.runId || "").trim();
  const text = String(opts.text || "").trim();
  if (!runId) throw new Error("Active run id is not available yet.");
  if (!text) throw new Error("Steer text is empty.");

  const base = opts.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/v1/runs/${encodeURIComponent(runId)}/steer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({ input: text, message: text, text }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail
        ? `Steer failed (${res.status}): ${detail.slice(0, 200)}`
        : `Steer failed (${res.status})`,
    );
  }
}
