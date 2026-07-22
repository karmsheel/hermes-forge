/**
 * Hermes Sessions API client (`/api/sessions/*`).
 * @see docs/references/HERMES_API_SERVER.md
 * @see docs/references/upstream/hermes-api-server.md
 */

export type HermesSessionSummary = {
  id: string;
  source?: string | null;
  userId?: string | null;
  model?: string | null;
  title?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  endReason?: string | null;
  messageCount?: number | null;
  toolCallCount?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
  reasoningTokens?: number | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  apiCallCount?: number | null;
  parentSessionId?: string | null;
  lastActive?: string | null;
  preview?: string | null;
  lineageRootId?: string | null;
  hasSystemPrompt?: boolean;
  hasModelConfig?: boolean;
  raw?: unknown;
};

export type HermesSessionMessage = {
  id?: string | null;
  sessionId?: string | null;
  role: string;
  content: string;
  toolCallId?: string | null;
  toolCalls?: unknown;
  toolName?: string | null;
  timestamp?: number | string | null;
  tokenCount?: number | null;
  finishReason?: string | null;
  reasoning?: string | null;
  reasoningContent?: string | null;
  raw?: unknown;
};

export type HermesSessionsListParams = {
  limit?: number;
  offset?: number;
  source?: string | null;
  includeChildren?: boolean;
};

export type HermesSessionsListResult = {
  sessions: HermesSessionSummary[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type HermesSessionCreateInput = {
  title?: string;
  model?: string;
  id?: string;
  systemPrompt?: string;
};

export type HermesSessionUpdateInput = {
  title?: string | null;
  endReason?: string | null;
};

export type HermesSessionChatInput = {
  message: string;
  systemMessage?: string;
  sessionKey?: string;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function authHeaders(apiKey: string, extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) {
      if (
        key.toLowerCase().includes("at") ||
        key.toLowerCase().includes("time") ||
        key === "timestamp" ||
        key === "last_active" ||
        key === "lastActive"
      ) {
        const ms = v > 1e12 ? v : v > 1e9 ? v * 1000 : null;
        if (ms != null && ms > 1e11) return new Date(ms).toISOString();
      }
      return String(v);
    }
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}

function contentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const p = part as Record<string, unknown>;
        if (typeof p.text === "string") return p.text;
        if (typeof p.content === "string") return p.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.content === "string") return o.content;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

/**
 * Normalize a raw Hermes session object into HermesSessionSummary.
 * Tolerant of snake_case / camelCase and nested `session` wrappers.
 */
export function normalizeHermesSession(raw: unknown): HermesSessionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const session =
    root.session && typeof root.session === "object"
      ? (root.session as Record<string, unknown>)
      : root;

  const id =
    pickString(session, ["id", "session_id", "sessionId"]) ??
    pickString(root, ["id", "session_id", "sessionId"]);
  if (!id) return null;

  return {
    id,
    source: pickString(session, ["source"]) ?? null,
    userId: pickString(session, ["user_id", "userId"]) ?? null,
    model: pickString(session, ["model"]) ?? null,
    title: pickString(session, ["title", "name"]) ?? null,
    startedAt:
      pickString(session, ["started_at", "startedAt", "created_at", "createdAt"]) ?? null,
    endedAt: pickString(session, ["ended_at", "endedAt"]) ?? null,
    endReason: pickString(session, ["end_reason", "endReason"]) ?? null,
    messageCount: pickNumber(session, ["message_count", "messageCount"]) ?? null,
    toolCallCount: pickNumber(session, ["tool_call_count", "toolCallCount"]) ?? null,
    inputTokens: pickNumber(session, ["input_tokens", "inputTokens", "prompt_tokens"]) ?? null,
    outputTokens:
      pickNumber(session, ["output_tokens", "outputTokens", "completion_tokens"]) ?? null,
    cacheReadTokens: pickNumber(session, ["cache_read_tokens", "cacheReadTokens"]) ?? null,
    cacheWriteTokens: pickNumber(session, ["cache_write_tokens", "cacheWriteTokens"]) ?? null,
    reasoningTokens: pickNumber(session, ["reasoning_tokens", "reasoningTokens"]) ?? null,
    estimatedCostUsd: pickNumber(session, ["estimated_cost_usd", "estimatedCostUsd"]) ?? null,
    actualCostUsd: pickNumber(session, ["actual_cost_usd", "actualCostUsd"]) ?? null,
    apiCallCount: pickNumber(session, ["api_call_count", "apiCallCount"]) ?? null,
    parentSessionId:
      pickString(session, ["parent_session_id", "parentSessionId"]) ?? null,
    lastActive: pickString(session, ["last_active", "lastActive", "updated_at", "updatedAt"]) ?? null,
    preview: pickString(session, ["preview", "snippet", "summary"]) ?? null,
    lineageRootId:
      pickString(session, ["_lineage_root_id", "lineage_root_id", "lineageRootId"]) ?? null,
    hasSystemPrompt: pickBool(session, ["has_system_prompt", "hasSystemPrompt"]),
    hasModelConfig: pickBool(session, ["has_model_config", "hasModelConfig"]),
    raw,
  };
}

export function normalizeHermesMessage(raw: unknown): HermesSessionMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const role = pickString(m, ["role"]) ?? "unknown";
  const content = contentToString(m.content ?? m.message ?? m.text);
  return {
    id: pickString(m, ["id", "message_id", "messageId"]) ?? null,
    sessionId: pickString(m, ["session_id", "sessionId"]) ?? null,
    role,
    content,
    toolCallId: pickString(m, ["tool_call_id", "toolCallId"]) ?? null,
    toolCalls: m.tool_calls ?? m.toolCalls,
    toolName: pickString(m, ["tool_name", "toolName"]) ?? null,
    timestamp:
      pickNumber(m, ["timestamp"]) ??
      pickString(m, ["timestamp", "created_at", "createdAt"]) ??
      null,
    tokenCount: pickNumber(m, ["token_count", "tokenCount"]) ?? null,
    finishReason: pickString(m, ["finish_reason", "finishReason"]) ?? null,
    reasoning: pickString(m, ["reasoning"]) ?? null,
    reasoningContent: pickString(m, ["reasoning_content", "reasoningContent"]) ?? null,
    raw,
  };
}

async function hermesJson(
  url: string,
  apiKey: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(apiKey, init?.headers),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 500) };
    }
  }
  if (!res.ok) {
    const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const msg =
      (errObj && typeof errObj.error === "string" && errObj.error) ||
      (errObj &&
        errObj.error &&
        typeof errObj.error === "object" &&
        typeof (errObj.error as { message?: string }).message === "string" &&
        (errObj.error as { message: string }).message) ||
      text.slice(0, 300) ||
      `HTTP ${res.status}`;
    throw new Error(`Hermes sessions request failed (${res.status}): ${msg}`);
  }
  return data;
}

export async function listHermesSessions(
  baseUrl: string,
  apiKey: string,
  params: HermesSessionsListParams = {},
): Promise<HermesSessionsListResult> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  if (params.source?.trim()) qs.set("source", params.source.trim());
  if (params.includeChildren) qs.set("include_children", "true");

  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions?${qs.toString()}`,
    apiKey,
  );
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.sessions)
        ? root.sessions
        : [];

  return {
    sessions: arr
      .map((item) => normalizeHermesSession(item))
      .filter((s): s is HermesSessionSummary => Boolean(s)),
    limit: typeof root.limit === "number" ? root.limit : limit,
    offset: typeof root.offset === "number" ? root.offset : offset,
    hasMore: typeof root.has_more === "boolean" ? root.has_more : arr.length === limit,
  };
}

export async function createHermesSession(
  baseUrl: string,
  apiKey: string,
  input: HermesSessionCreateInput = {},
): Promise<HermesSessionSummary> {
  const body: Record<string, unknown> = {};
  if (input.title != null) body.title = input.title;
  if (input.model != null) body.model = input.model;
  if (input.id != null) body.id = input.id;
  if (input.systemPrompt != null) body.system_prompt = input.systemPrompt;

  const data = await hermesJson(`${normalizeBaseUrl(baseUrl)}/api/sessions`, apiKey, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const session = normalizeHermesSession(data);
  if (!session) throw new Error("Hermes returned a session payload without an id");
  return session;
}

export async function getHermesSession(
  baseUrl: string,
  apiKey: string,
  sessionId: string,
): Promise<HermesSessionSummary> {
  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}`,
    apiKey,
  );
  const session = normalizeHermesSession(data);
  if (!session) throw new Error("Hermes returned a session payload without an id");
  return session;
}

export async function updateHermesSession(
  baseUrl: string,
  apiKey: string,
  sessionId: string,
  input: HermesSessionUpdateInput,
): Promise<HermesSessionSummary> {
  const body: Record<string, unknown> = {};
  if ("title" in input) body.title = input.title;
  if (input.endReason) body.end_reason = input.endReason;

  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}`,
    apiKey,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const session = normalizeHermesSession(data);
  if (!session) throw new Error("Hermes returned a session payload without an id");
  return session;
}

export async function deleteHermesSession(
  baseUrl: string,
  apiKey: string,
  sessionId: string,
): Promise<{ id: string; deleted: boolean }> {
  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}`,
    apiKey,
    { method: "DELETE" },
  );
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    id: typeof root.id === "string" ? root.id : sessionId,
    deleted: root.deleted !== false,
  };
}

export async function listHermesSessionMessages(
  baseUrl: string,
  apiKey: string,
  sessionId: string,
): Promise<{ sessionId: string; messages: HermesSessionMessage[] }> {
  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
    apiKey,
  );
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.messages)
        ? root.messages
        : [];
  return {
    sessionId:
      (typeof root.session_id === "string" && root.session_id) ||
      (typeof root.sessionId === "string" && root.sessionId) ||
      sessionId,
    messages: arr
      .map((item) => normalizeHermesMessage(item))
      .filter((m): m is HermesSessionMessage => Boolean(m)),
  };
}

export async function forkHermesSession(
  baseUrl: string,
  apiKey: string,
  sessionId: string,
  input: { title?: string; id?: string } = {},
): Promise<HermesSessionSummary> {
  const body: Record<string, unknown> = {};
  if (input.title != null) body.title = input.title;
  if (input.id != null) body.id = input.id;

  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}/fork`,
    apiKey,
    { method: "POST", body: JSON.stringify(body) },
  );
  const session = normalizeHermesSession(data);
  if (!session) throw new Error("Hermes returned a fork payload without an id");
  return session;
}

export type HermesSessionChatResult = {
  sessionId: string;
  content: string;
  role: string;
  usage?: Record<string, number> | null;
  raw: unknown;
};

export async function chatHermesSession(
  baseUrl: string,
  apiKey: string,
  sessionId: string,
  input: HermesSessionChatInput,
): Promise<HermesSessionChatResult> {
  const headers: Record<string, string> = {};
  if (input.sessionKey?.trim()) {
    headers["X-Hermes-Session-Key"] = input.sessionKey.trim().slice(0, 256);
  }

  const body: Record<string, unknown> = { message: input.message };
  if (input.systemMessage?.trim()) body.system_message = input.systemMessage.trim();

  const data = await hermesJson(
    `${normalizeBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}/chat`,
    apiKey,
    { method: "POST", body: JSON.stringify(body), headers },
  );
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const message =
    root.message && typeof root.message === "object"
      ? (root.message as Record<string, unknown>)
      : root;
  const content = contentToString(
    message.content ?? root.content ?? root.final_response ?? root.output,
  );
  const role = pickString(message, ["role"]) ?? "assistant";
  const usage =
    root.usage && typeof root.usage === "object"
      ? (root.usage as Record<string, number>)
      : null;

  return {
    sessionId:
      pickString(root, ["session_id", "sessionId"]) ?? sessionId,
    content,
    role,
    usage,
    raw: data,
  };
}

/** Display title helper for list/detail UI. */
export function sessionDisplayTitle(session: HermesSessionSummary): string {
  if (session.title?.trim()) return session.title.trim();
  if (session.preview?.trim()) {
    const p = session.preview.trim();
    return p.length > 48 ? `${p.slice(0, 48)}…` : p;
  }
  return session.id;
}
