/**
 * Hermes API session headers for memory / transcript scoping.
 * @see docs/references/HERMES_API_SERVER.md §4.5
 */

export type HermesSessionKeyInput = {
  userId: string;
  businessId: string;
  /** Hermes agent profileKey (e.g. overlord). Falls back to "default". */
  agentProfileKey?: string | null;
};

/**
 * Stable long-term memory scope (Honcho / X-Hermes-Session-Key).
 * Format: forge:{userId}:{businessId}:{agentProfileKey|default}
 */
export function buildHermesSessionKey(input: HermesSessionKeyInput): string {
  const userId = String(input.userId || "").trim() || "unknown";
  const businessId = String(input.businessId || "").trim() || "unknown";
  const agent =
    String(input.agentProfileKey || "")
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default";
  return `forge:${userId}:${businessId}:${agent}`;
}

/**
 * Transcript continuity id (X-Hermes-Session-Id).
 * Format: forge-conv:{conversationId}
 */
export function buildHermesSessionId(
  conversationId: string | null | undefined,
): string | null {
  const id = String(conversationId || "").trim();
  if (!id) return null;
  return `forge-conv:${id}`;
}

export type HermesSessionHeaderOptions = {
  sessionKey: string;
  sessionId?: string | null;
};

/** Ready-to-spread options for callHermes / streamHermesEvents. */
export function hermesSessionCallOptions(input: {
  userId: string;
  businessId: string;
  agentProfileKey?: string | null;
  conversationId?: string | null;
}): HermesSessionHeaderOptions {
  return {
    sessionKey: buildHermesSessionKey({
      userId: input.userId,
      businessId: input.businessId,
      agentProfileKey: input.agentProfileKey,
    }),
    sessionId: buildHermesSessionId(input.conversationId),
  };
}
