/**
 * Normalize Hermes usage objects from Chat Completions, Responses, or Runs APIs.
 * See docs/references/HERMES_API_SERVER.md §3.
 */

export type NormalizedHermesUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  source: "chat_completions" | "responses" | "unknown";
};

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

/**
 * Accept raw usage blobs or full response objects that nest `usage`.
 */
export function normalizeHermesUsage(
  raw: unknown,
): NormalizedHermesUsage | null {
  if (raw == null || typeof raw !== "object") return null;

  const root = raw as Record<string, unknown>;
  const u =
    root.usage && typeof root.usage === "object"
      ? (root.usage as Record<string, unknown>)
      : root;

  const prompt =
    num(u.prompt_tokens) ?? num(u.input_tokens) ?? num(u.promptTokens);
  const completion =
    num(u.completion_tokens) ??
    num(u.output_tokens) ??
    num(u.completionTokens);
  const total = num(u.total_tokens) ?? num(u.totalTokens);

  if (prompt == null && completion == null && total == null) return null;

  const promptTokens = prompt ?? 0;
  const completionTokens = completion ?? 0;
  const totalTokens =
    total ??
    (prompt != null || completion != null
      ? promptTokens + completionTokens
      : 0);

  const source: NormalizedHermesUsage["source"] =
    num(u.prompt_tokens) != null || num(u.completion_tokens) != null
      ? "chat_completions"
      : num(u.input_tokens) != null || num(u.output_tokens) != null
        ? "responses"
        : "unknown";

  return { promptTokens, completionTokens, totalTokens, source };
}

function formatWholeNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Short dock label for last-turn Hermes-reported usage. */
export function formatLastTurnUsageLabel(
  usage: NormalizedHermesUsage,
): string {
  const prompt = formatWholeNumber(usage.promptTokens);
  return `Last turn · ${prompt} tok (Hermes)`;
}
