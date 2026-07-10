/**
 * Redact secrets from studio page context before prompt injection.
 * Conservative patterns — false positives preferred over leaking keys.
 */

const SECRET_PATTERNS: RegExp[] = [
  // OpenAI / Anthropic / generic sk- keys
  /\bsk-[a-zA-Z0-9_\-]{16,}\b/g,
  // Bearer tokens in prose
  /\bBearer\s+[a-zA-Z0-9\-._~+\/]+=*\b/gi,
  // Common env-style assignments
  /\b(?:API[_-]?KEY|AUTH[_-]?TOKEN|ACCESS[_-]?TOKEN|SECRET[_-]?KEY|HERMES[_-]?API[_-]?KEY)\s*[=:]\s*["']?[^\s"'\\]{8,}["']?/gi,
  // Long hex / base64-ish secrets
  /\b(?:xox[baprs]-|ghp_|gho_|github_pat_)[a-zA-Z0-9_\-]{16,}\b/g,
  // JWT-ish
  /\beyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b/g,
];

const REDACTED = "[REDACTED]";

export type RedactionResult = {
  text: string;
  redactionCount: number;
};

export function redactSecrets(input: string): RedactionResult {
  let text = String(input ?? "");
  let redactionCount = 0;

  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    text = text.replace(pattern, () => {
      redactionCount += 1;
      return REDACTED;
    });
  }

  return { text, redactionCount };
}

export function redactRecord(
  details: Record<string, unknown> | undefined,
): { details?: Record<string, unknown>; redactionCount: number } {
  if (!details || typeof details !== "object") {
    return { details: undefined, redactionCount: 0 };
  }
  try {
    const raw = JSON.stringify(details);
    const { text, redactionCount } = redactSecrets(raw);
    return {
      details: JSON.parse(text) as Record<string, unknown>,
      redactionCount,
    };
  } catch {
    return { details: undefined, redactionCount: 0 };
  }
}
