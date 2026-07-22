/**
 * Context window meter for the chatbar desktop dock (4.17 PR-6).
 * Rough local estimate when Hermes runtime usage is unavailable.
 */

/** Chars → tokens heuristic used by hermes-browser-extension. */
export function estimateTokens(value = ""): number {
  const chars = String(value || "").length;
  return chars ? Math.ceil(chars / 4) : 0;
}

/** Default context window when the model does not report one. */
export const DEFAULT_MODEL_CONTEXT_TOKENS = 128_000;

export type ContextMeterInput = {
  /** Prior chat history (roles + content). */
  messages?: ReadonlyArray<{ role?: string; content?: string }>;
  draftText?: string;
  /** Page snapshot / registration lines injected when follow-page. */
  contextText?: string;
  systemOverheadChars?: number;
  modelContextTokens?: number;
  /**
   * Last-turn Hermes-reported prompt tokens (billing usage).
   * When set, meter shows dual signal: estimate for draft + last-turn label.
   */
  lastTurnPromptTokens?: number | null;
};

export type ContextMeterDisplay = {
  estimatedTokens: number;
  modelContextTokens: number;
  percentUsed: number | null;
  percentLabel: string;
  usedLabel: string;
  limitLabel: string;
  level: "ok" | "warn" | "critical" | "unknown";
  detail: string;
  title: string;
};

function formatWholeNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function estimateStudioPromptTokens({
  messages = [],
  draftText = "",
  contextText = "",
  systemOverheadChars = 1200,
}: ContextMeterInput = {}): number {
  let chars = Math.max(0, Number(systemOverheadChars) || 0);
  for (const m of messages) {
    chars += String(m.content || "").length + 16;
  }
  chars += String(draftText || "").length;
  chars += String(contextText || "").length;
  return chars ? Math.ceil(chars / 4) : 0;
}

export function formatContextMeter({
  estimatedTokens = 0,
  modelContextTokens = 0,
}: {
  estimatedTokens?: number;
  modelContextTokens?: number;
} = {}): Pick<
  ContextMeterDisplay,
  "estimatedTokens" | "modelContextTokens" | "percentUsed" | "percentLabel" | "level"
> {
  const used = Math.max(0, Math.round(Number(estimatedTokens) || 0));
  const limit = Math.max(0, Math.round(Number(modelContextTokens) || 0));
  if (!limit) {
    return {
      estimatedTokens: used,
      modelContextTokens: 0,
      percentUsed: null,
      percentLabel: "—",
      level: "unknown",
    };
  }
  const percentUsed = Math.min(999, Math.round((used / limit) * 1000) / 10);
  const level: ContextMeterDisplay["level"] =
    percentUsed >= 90 ? "critical" : percentUsed >= 70 ? "warn" : "ok";
  return {
    estimatedTokens: used,
    modelContextTokens: limit,
    percentUsed,
    percentLabel: `${percentUsed}%`,
    level,
  };
}

export function contextMeterDisplay(input: ContextMeterInput = {}): ContextMeterDisplay {
  const estimatedTokens = estimateStudioPromptTokens(input);
  const modelContextTokens =
    Number(input.modelContextTokens) > 0
      ? Math.round(Number(input.modelContextTokens))
      : DEFAULT_MODEL_CONTEXT_TOKENS;

  const meter = formatContextMeter({ estimatedTokens, modelContextTokens });
  const usedLabel = formatWholeNumber(meter.estimatedTokens);
  const limitLabel = formatWholeNumber(meter.modelContextTokens);

  const lastTurn =
    input.lastTurnPromptTokens != null &&
    Number.isFinite(input.lastTurnPromptTokens) &&
    input.lastTurnPromptTokens > 0
      ? Math.round(Number(input.lastTurnPromptTokens))
      : null;
  const lastTurnLabel = lastTurn != null ? formatWholeNumber(lastTurn) : null;

  const detail =
    lastTurnLabel != null
      ? `${usedLabel} / ${limitLabel} · est · last ${lastTurnLabel}`
      : `${usedLabel} / ${limitLabel} · ${meter.percentLabel} · estimate`;

  const title =
    lastTurnLabel != null
      ? `Draft estimate: ~${usedLabel} of ${limitLabel} tokens (${meter.percentLabel}). Last Hermes turn prompt: ${lastTurnLabel} tokens (billing usage, not remaining window).`
      : `Next request estimate: ~${usedLabel} tokens of ${limitLabel} (${meter.percentLabel}). Based on history + draft + page context; not live runtime usage.`;

  return {
    ...meter,
    usedLabel,
    limitLabel,
    detail,
    title,
  };
}
