/**
 * Hermes gateway capability helpers for the chatbar (4.17 PR-6).
 * Features arrive from probe as a string[] of enabled capability names.
 */

import type { HermesApprovalChoice } from "./runtime-events";

export type { HermesApprovalChoice };

export type ChatbarCapabilities = {
  runStop: boolean;
  runSteer: boolean;
  runApproval: boolean;
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

const APPROVAL_NAMES = [
  "run_approval",
  "runApproval",
  "run_approval_response",
  "runApprovalResponse",
  "approval",
];

function hasAny(features: readonly string[], names: string[]): boolean {
  const set = new Set(features.map((f) => f.toLowerCase()));
  return names.some((n) => set.has(n.toLowerCase()));
}

/**
 * Normalize Hermes probe `features` into chatbar capability flags.
 * When features are missing/empty (legacy gateway), stop is assumed available
 * via AbortController; steer stays off until advertised.
 * Approval stays optimistic (true when features empty) so an `approval.request`
 * event can still be answered if the probe list is incomplete.
 */
export function parseChatbarCapabilities(
  features: readonly string[] | null | undefined,
): ChatbarCapabilities {
  const raw = Array.isArray(features) ? features.filter(Boolean).map(String) : [];
  if (raw.length === 0) {
    return {
      runStop: true,
      runSteer: false,
      runApproval: true,
      models: true,
      sessions: true,
      raw,
    };
  }

  return {
    runStop: hasAny(raw, STOP_NAMES) || true, // client abort always works
    runSteer: hasAny(raw, STEER_NAMES),
    runApproval: hasAny(raw, APPROVAL_NAMES),
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

export function canApproveFromFeatures(
  features: readonly string[] | null | undefined,
): boolean {
  return parseChatbarCapabilities(features).runApproval;
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

/**
 * POST an approval decision into a Hermes run waiting on human gate.
 * Body shape matches Hermes API server: `{ choice, all? }`.
 * `choice` accepts once | session | always | deny (aliases: approve → once).
 */
export async function approveActiveRun(opts: {
  baseUrl: string;
  apiKey?: string;
  runId: string;
  choice: HermesApprovalChoice | "approve" | "approved" | "allow" | "deny";
  /** Resolve all pending approvals for this run's session queue. */
  resolveAll?: boolean;
  signal?: AbortSignal;
}): Promise<{ choice: string; resolved: number }> {
  const runId = String(opts.runId || "").trim();
  if (!runId) throw new Error("Active run id is not available yet.");

  const raw = String(opts.choice || "").trim().toLowerCase();
  const aliases: Record<string, HermesApprovalChoice> = {
    approve: "once",
    approved: "once",
    allow: "once",
  };
  const choice = (aliases[raw] || raw) as HermesApprovalChoice;
  const allowed: HermesApprovalChoice[] = ["once", "session", "always", "deny"];
  if (!allowed.includes(choice)) {
    throw new Error(
      `Invalid approval choice "${opts.choice}"; expected once, session, always, or deny.`,
    );
  }

  const base = opts.baseUrl.replace(/\/$/, "");
  const body: Record<string, unknown> = { choice };
  if (opts.resolveAll) body.all = true;

  const res = await fetch(
    `${base}/v1/runs/${encodeURIComponent(runId)}/approval`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail
        ? `Approval failed (${res.status}): ${detail.slice(0, 200)}`
        : `Approval failed (${res.status})`,
    );
  }

  try {
    const json = (await res.json()) as { choice?: string; resolved?: number };
    return {
      choice: String(json.choice || choice),
      resolved: Number(json.resolved ?? 1),
    };
  } catch {
    return { choice, resolved: 1 };
  }
}
