/**
 * One-shot handoff: Home / entry seeds a studio user message, then Foundation
 * chatbar opens and requests Hermes replyOnly for that conversation.
 */

export type PendingStudioReply = {
  conversationId: string;
  businessId: string;
  hermesAgentProfileId?: string | null;
};

const PENDING_STUDIO_REPLY_KEY = "pendingStudioReply";

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function setPendingStudioReply(payload: PendingStudioReply): void {
  const storage = getSessionStorage();
  if (!storage) return;
  if (!payload.conversationId || !payload.businessId) return;
  try {
    storage.setItem(PENDING_STUDIO_REPLY_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingStudioReply(): PendingStudioReply | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_STUDIO_REPLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingStudioReply;
    if (
      !parsed ||
      typeof parsed.conversationId !== "string" ||
      typeof parsed.businessId !== "string" ||
      !parsed.conversationId ||
      !parsed.businessId
    ) {
      return null;
    }
    return {
      conversationId: parsed.conversationId,
      businessId: parsed.businessId,
      hermesAgentProfileId:
        typeof parsed.hermesAgentProfileId === "string"
          ? parsed.hermesAgentProfileId
          : parsed.hermesAgentProfileId ?? null,
    };
  } catch {
    return null;
  }
}

export function consumePendingStudioReply(): PendingStudioReply | null {
  const value = peekPendingStudioReply();
  const storage = getSessionStorage();
  if (storage) {
    try {
      storage.removeItem(PENDING_STUDIO_REPLY_KEY);
    } catch {
      /* ignore */
    }
  }
  return value;
}
