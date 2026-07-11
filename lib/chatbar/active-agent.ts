/** Persist selected chatbar agent (hired Hermes profile) per business. */

const KEY_PREFIX = "forge.chatbar.activeAgent:";

export function activeChatbarAgentStorageKey(businessId: string): string {
  return `${KEY_PREFIX}${businessId}`;
}

export function loadActiveChatbarAgentId(
  businessId: string,
  storage: Pick<Storage, "getItem"> | null | undefined =
    typeof window !== "undefined" ? window.localStorage : null,
): string | null {
  if (!storage || !businessId) return null;
  try {
    return storage.getItem(activeChatbarAgentStorageKey(businessId));
  } catch {
    return null;
  }
}

export function saveActiveChatbarAgentId(
  businessId: string,
  agentId: string,
  storage: Pick<Storage, "setItem"> | null | undefined =
    typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage || !businessId || !agentId) return;
  try {
    storage.setItem(activeChatbarAgentStorageKey(businessId), agentId);
  } catch {
    /* ignore */
  }
}

export function clearActiveChatbarAgentId(
  businessId: string,
  storage: Pick<Storage, "removeItem"> | null | undefined =
    typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage || !businessId) return;
  try {
    storage.removeItem(activeChatbarAgentStorageKey(businessId));
  } catch {
    /* ignore */
  }
}
