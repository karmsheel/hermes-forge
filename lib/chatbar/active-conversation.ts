/** Persist last active studio conversation per business (client-only). */

const KEY_PREFIX = "forge.chatbar.activeConversation:";

export function activeStudioConversationStorageKey(businessId: string): string {
  return `${KEY_PREFIX}${businessId}`;
}

export function loadActiveStudioConversationId(
  businessId: string,
  storage: Pick<Storage, "getItem"> | null | undefined =
    typeof window !== "undefined" ? window.localStorage : null,
): string | null {
  if (!storage || !businessId) return null;
  try {
    return storage.getItem(activeStudioConversationStorageKey(businessId));
  } catch {
    return null;
  }
}

export function saveActiveStudioConversationId(
  businessId: string,
  conversationId: string,
  storage: Pick<Storage, "setItem"> | null | undefined =
    typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage || !businessId || !conversationId) return;
  try {
    storage.setItem(activeStudioConversationStorageKey(businessId), conversationId);
  } catch {
    /* ignore */
  }
}
