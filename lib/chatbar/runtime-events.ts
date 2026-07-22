/**
 * Normalize Hermes runtime / tool stream events for the Tool Activity Strip.
 * Adapted from hermes-browser-extension `runtime-events.mjs` + `normalizeToolActivity`.
 */

import { redactSecrets } from "./redaction";

export const FORGE_RUNTIME_EVENT_NAMES = Object.freeze({
  runStarted: "run.started",
  runCompleted: "run.completed",
  assistantDelta: "assistant.delta",
  assistantCompleted: "assistant.completed",
  toolStarted: "tool.started",
  toolProgress: "tool.progress",
  toolFinished: "tool.finished",
  approvalRequested: "approval.requested",
  approvalResolved: "approval.resolved",
  steerAccepted: "steer.accepted",
  steerQueued: "steer.queued",
  sessionReset: "session.reset",
  subagentFinished: "subagent.finished",
});

export const TOOL_EVENT_NAME_ALIASES = Object.freeze({
  "hermes.tool.progress": "tool.progress",
  "tool.call.started": "tool.started",
  "tool.call.progress": "tool.progress",
  "tool.call.completed": "tool.finished",
  "tool.call.finished": "tool.finished",
  "tool.call.error": "tool.finished",
  tool: "tool.progress",
  tool_activity: "tool.progress",
  /** Hermes API server emits `approval.request` / `approval.responded`. */
  "approval.request": "approval.requested",
  "approval.responded": "approval.resolved",
});

const EVENT_NAME_SET = new Set(Object.values(FORGE_RUNTIME_EVENT_NAMES));
const CONTROL_EVENT_PATTERN = /(^|\.)control(\.|$)|browser\.control/i;
const PREVIEW_LIMIT = 240;

export type ToolCategory =
  | "file"
  | "web"
  | "terminal"
  | "browser"
  | "image"
  | "memory"
  | "meta";

export type ToolActivity = {
  activityId: string;
  rawName: string;
  category: ToolCategory;
  label: string;
  preview: string;
  status: string;
  ts: number;
};

export type NormalizedRuntimeEvent = {
  name: string;
  rawName: string;
  status?: string;
  toolName?: string;
  preview?: string;
  data: Record<string, unknown>;
};

/** Hermes run approval choices accepted by POST /v1/runs/{id}/approval. */
export type HermesApprovalChoice = "once" | "session" | "always" | "deny";

export type PendingRunApproval = {
  runId: string;
  command: string;
  description: string;
  choices: HermesApprovalChoice[];
  patternKey?: string;
  smartDenied?: boolean;
  allowPermanent?: boolean;
  raw: Record<string, unknown>;
};

const DEFAULT_APPROVAL_CHOICES: HermesApprovalChoice[] = [
  "once",
  "session",
  "always",
  "deny",
];

const APPROVAL_CHOICE_SET = new Set<string>(DEFAULT_APPROVAL_CHOICES);

/**
 * Extract a pending run-approval prompt from a runtime/SSE payload.
 * Returns null when the event is not an approval request (or lacks a run id).
 */
export function parsePendingRunApproval(
  event: Record<string, unknown> = {},
): PendingRunApproval | null {
  // Studio SSE may nest the original Hermes envelope under `event`.
  const nestedEnvelope =
    event.event && typeof event.event === "object" && !Array.isArray(event.event)
      ? (event.event as Record<string, unknown>)
      : null;
  const candidate = nestedEnvelope
    ? { ...nestedEnvelope, ...event, data: nestedEnvelope.data ?? event.data }
    : event;

  const normalized = normalizeRuntimeEvent(candidate);
  const isRequest =
    normalized.name === FORGE_RUNTIME_EVENT_NAMES.approvalRequested ||
    /approval\.request/i.test(normalized.rawName) ||
    /approval\.request/i.test(String(candidate.type || candidate.event || ""));
  if (!isRequest) return null;

  const data = {
    ...normalized.data,
    ...(typeof candidate.run_id === "string" || typeof candidate.runId === "string"
      ? candidate
      : {}),
  };
  const runId = String(
    data.run_id ||
      data.runId ||
      candidate.run_id ||
      candidate.runId ||
      event.run_id ||
      event.runId ||
      "",
  ).trim();
  if (!runId) return null;

  const command = String(
    data.command || data.display_command || data.code || data.tool || "",
  ).trim();
  const description = String(
    data.description || data.message || data.reason || data.preview || "",
  ).trim();

  const rawChoices = Array.isArray(data.choices) ? data.choices : null;
  let choices: HermesApprovalChoice[] = rawChoices
    ? rawChoices
        .map((c) => String(c).trim().toLowerCase())
        .filter((c): c is HermesApprovalChoice => APPROVAL_CHOICE_SET.has(c))
    : [...DEFAULT_APPROVAL_CHOICES];

  if (data.smart_denied || data.smartDenied) {
    choices = choices.filter((c) => c === "once" || c === "deny");
    if (choices.length === 0) choices = ["once", "deny"];
  } else if (data.allow_permanent === false || data.allowPermanent === false) {
    choices = choices.filter((c) => c !== "always");
  }

  if (choices.length === 0) choices = [...DEFAULT_APPROVAL_CHOICES];
  if (!choices.includes("deny")) choices = [...choices, "deny"];

  return {
    runId,
    command: command.slice(0, 2000),
    description: description.slice(0, 800),
    choices,
    patternKey: String(data.pattern_key || data.patternKey || "").trim() || undefined,
    smartDenied: Boolean(data.smart_denied || data.smartDenied),
    allowPermanent: data.allow_permanent !== false && data.allowPermanent !== false,
    raw: data,
  };
}

/** True when the event closes a pending approval (responded / resolved). */
export function isApprovalResolvedEvent(
  event: Record<string, unknown> = {},
): boolean {
  const normalized = normalizeRuntimeEvent(event);
  return (
    normalized.name === FORGE_RUNTIME_EVENT_NAMES.approvalResolved ||
    /approval\.(responded|resolved)/i.test(normalized.rawName)
  );
}

const TOOL_CATEGORY_PATTERNS: Array<[ToolCategory, RegExp]> = [
  ["browser", /browser|click|navigate|scroll|type_text|fill|page\./i],
  ["image", /image_generate|vision|screenshot|image/i],
  ["terminal", /terminal|shell|bash|exec|run_command|process/i],
  ["web", /web_search|http|fetch|browse|url/i],
  ["file", /read_file|write_file|search_file|patch|edit_file|glob|grep|file/i],
  ["memory", /memory|recall|remember/i],
];

const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  file: "Working with files",
  web: "Searching the web",
  terminal: "Running a command",
  browser: "Using the browser",
  image: "Working with images",
  memory: "Updating memory",
  meta: "Using a tool",
};

const TOOL_LABELS: Record<string, string> = {
  read_file: "Reading file",
  write_file: "Writing file",
  web_search: "Searching web",
  terminal: "Running command",
  image_generate: "Generating image",
};

export function forgeRuntimeEventName(name = ""): string {
  const raw = String(name || "").trim();
  if (!raw || CONTROL_EVENT_PATTERN.test(raw)) return "runtime.unknown";
  const asKey = raw as keyof typeof FORGE_RUNTIME_EVENT_NAMES;
  if (FORGE_RUNTIME_EVENT_NAMES[asKey]) return FORGE_RUNTIME_EVENT_NAMES[asKey];
  const alias =
    TOOL_EVENT_NAME_ALIASES[raw as keyof typeof TOOL_EVENT_NAME_ALIASES] || raw;
  return EVENT_NAME_SET.has(alias) ? alias : "runtime.unknown";
}

export function toolCategoryForName(name = ""): ToolCategory {
  const rawName = String(name || "").trim();
  if (!rawName) return "meta";
  const match = TOOL_CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(rawName));
  return match?.[0] || "meta";
}

export function toolLabelForName(
  name = "",
  category: ToolCategory = toolCategoryForName(name),
): string {
  const rawName = String(name || "").trim();
  if (TOOL_LABELS[rawName]) return TOOL_LABELS[rawName];
  if (/click/i.test(rawName)) return "Clicking browser";
  if (/type|fill/i.test(rawName)) return "Typing in browser";
  if (/scroll/i.test(rawName)) return "Scrolling page";
  if (/navigate|back/i.test(rawName)) return "Navigating browser";
  if (/image_generate/i.test(rawName)) return "Generating image";
  if (/vision|image/i.test(rawName)) return "Reading image";
  if (/write/i.test(rawName)) return "Writing file";
  if (/patch|edit/i.test(rawName)) return "Patching file";
  if (/search/i.test(rawName) && category === "file") return "Searching project";
  if (/search/i.test(rawName) && category === "web") return "Searching web";
  return TOOL_CATEGORY_LABELS[category] || "Using tool";
}

export function sanitizeToolPreview(value = "", maxChars = 110): string {
  const max = Math.max(0, Number(maxChars || 0));
  if (!max) return "";
  const { text: redacted } = redactSecrets(String(value || ""));
  const text = redacted.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LIMIT);
  if (text.length <= max) return text;
  if (max === 1) return ".";
  return `${text.slice(0, max - 1).trimEnd()}.`;
}

function toolStatusForEvent(name = "", data: Record<string, unknown> = {}): string {
  const explicit = String(data.status || data.state || "")
    .trim()
    .toLowerCase();
  if (explicit) return explicit;
  if (name === FORGE_RUNTIME_EVENT_NAMES.toolStarted) return "started";
  if (name === FORGE_RUNTIME_EVENT_NAMES.toolFinished) return "completed";
  return "progress";
}

function normalizeToolEventName(name = "", status = ""): string {
  if (name === FORGE_RUNTIME_EVENT_NAMES.toolProgress) {
    if (/^(started|running|begin|pending)$/i.test(status)) {
      return FORGE_RUNTIME_EVENT_NAMES.toolStarted;
    }
    if (/^(completed|finished|done|success|error|failed)$/i.test(status)) {
      return FORGE_RUNTIME_EVENT_NAMES.toolFinished;
    }
  }
  return name;
}

export function normalizeRuntimeEvent(event: Record<string, unknown> = {}): NormalizedRuntimeEvent {
  const rawType = String(event.type || event.event || event.name || "").trim();
  const nested =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : event;
  const aliased =
    TOOL_EVENT_NAME_ALIASES[rawType as keyof typeof TOOL_EVENT_NAME_ALIASES] || rawType;
  const baseName = forgeRuntimeEventName(aliased);

  if (baseName === "runtime.unknown") {
    return {
      name: "runtime.unknown",
      rawName: rawType,
      data: nested,
      preview: sanitizeToolPreview(
        String(nested.preview || nested.message || ""),
        PREVIEW_LIMIT,
      ),
    };
  }

  const status = toolStatusForEvent(baseName, nested);
  const name = normalizeToolEventName(baseName, status);
  const toolName = String(
    nested.tool_name || nested.toolName || nested.name || nested.rawName || "",
  ).trim();

  return {
    name,
    rawName: rawType,
    status,
    toolName,
    data: nested,
    preview: sanitizeToolPreview(
      String(
        nested.preview ||
          nested.detail ||
          nested.message ||
          nested.input ||
          nested.output ||
          "",
      ),
      PREVIEW_LIMIT,
    ),
  };
}

export function normalizeToolActivity(tool: Record<string, unknown> = {}): ToolActivity {
  const data =
    tool.data && typeof tool.data === "object" && !Array.isArray(tool.data)
      ? (tool.data as Record<string, unknown>)
      : tool;
  const rawName =
    String(
      data.tool_name ||
        data.tool ||
        data.name ||
        tool.toolName ||
        tool.rawName ||
        "Hermes tool",
    ).trim() || "Hermes tool";
  const category = toolCategoryForName(rawName);
  const activityId = String(
    data.tool_call_id ||
      data.toolCallId ||
      data.call_id ||
      data.callId ||
      data.tool_id ||
      data.toolId ||
      data.id ||
      tool.activityId ||
      "",
  )
    .trim()
    .slice(0, 160);

  const status =
    String(tool.status || data.status || data.state || "progress")
      .trim()
      .toLowerCase() || "progress";

  return {
    activityId: activityId || `tool-${rawName}-${Date.now()}`,
    rawName,
    category,
    label: toolLabelForName(rawName, category),
    preview: sanitizeToolPreview(
      String(tool.preview || data.preview || data.message || data.input || ""),
    ),
    status,
    ts: Date.now(),
  };
}

/**
 * Upsert tool activity rows for the strip.
 * Matching key: activityId when present, else rawName of the most recent open tool.
 */
export function reduceToolActivities(
  activities: readonly ToolActivity[] = [],
  event: Record<string, unknown> = {},
): ToolActivity[] {
  const normalized = normalizeRuntimeEvent(event);
  const isTool =
    normalized.name === FORGE_RUNTIME_EVENT_NAMES.toolStarted ||
    normalized.name === FORGE_RUNTIME_EVENT_NAMES.toolProgress ||
    normalized.name === FORGE_RUNTIME_EVENT_NAMES.toolFinished;

  if (!isTool) return [...activities];

  const next = normalizeToolActivity({
    ...normalized.data,
    toolName: normalized.toolName,
    status: normalized.status,
    preview: normalized.preview,
    activityId: String(
      normalized.data.tool_call_id ||
        normalized.data.toolCallId ||
        normalized.data.call_id ||
        normalized.data.id ||
        "",
    ),
  });

  if (
    normalized.name === FORGE_RUNTIME_EVENT_NAMES.toolFinished &&
    !/^(error|failed)$/i.test(next.status)
  ) {
    next.status = "completed";
  }

  const list = [...activities];
  const byId = next.activityId
    ? list.findIndex((a) => a.activityId === next.activityId)
    : -1;
  const byName =
    byId < 0
      ? list.findIndex(
          (a) =>
            a.rawName === next.rawName &&
            !/^(completed|finished|done|success|error|failed)$/i.test(a.status),
        )
      : -1;
  const idx = byId >= 0 ? byId : byName;

  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      ...next,
      activityId: list[idx].activityId || next.activityId,
      ts: Date.now(),
    };
    return list;
  }

  return [...list, next];
}

/** Keep strip compact: drop finished tools older than the last N active ones. */
export function pruneToolActivities(
  activities: readonly ToolActivity[],
  { max = 8 }: { max?: number } = {},
): ToolActivity[] {
  if (activities.length <= max) return [...activities];
  return activities.slice(-max);
}

/**
 * Detect tool-ish payloads from OpenAI chat.completions stream chunks.
 * Returns zero or more synthetic runtime events for the strip.
 */
export function toolEventsFromOpenAiChunk(
  chunk: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const c = choice as Record<string, unknown>;
    const delta =
      c.delta && typeof c.delta === "object"
        ? (c.delta as Record<string, unknown>)
        : null;
    if (!delta) continue;

    const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
    for (const call of toolCalls) {
      if (!call || typeof call !== "object") continue;
      const tc = call as Record<string, unknown>;
      const fn =
        tc.function && typeof tc.function === "object"
          ? (tc.function as Record<string, unknown>)
          : {};
      const name = String(fn.name || tc.name || "tool").trim() || "tool";
      const args = String(fn.arguments || tc.arguments || "").slice(0, 200);
      events.push({
        type: "tool.started",
        data: {
          tool_name: name,
          tool_call_id: String(tc.id || ""),
          status: "started",
          preview: args,
        },
      });
    }
  }

  // Hermes custom envelope on the chunk root
  const eventName = String(chunk.event || chunk.type || "").trim();
  if (eventName && forgeRuntimeEventName(eventName) !== "runtime.unknown") {
    events.push({
      type: eventName,
      data: (chunk.data as Record<string, unknown>) || chunk,
    });
  }

  return events;
}
