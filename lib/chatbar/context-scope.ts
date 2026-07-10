/**
 * Context scope for studio chatbar (PR-3).
 * chat-only | follow-page | pinned-entity (pin UI lands with PR-5/6).
 */

export const CHATBAR_CONTEXT_MODES = {
  CHAT_ONLY: "chat-only",
  FOLLOW_PAGE: "follow-page",
  PINNED_ENTITY: "pinned-entity",
} as const;

export type ChatbarContextMode =
  (typeof CHATBAR_CONTEXT_MODES)[keyof typeof CHATBAR_CONTEXT_MODES];

export const DEFAULT_CHATBAR_CONTEXT_MODE: ChatbarContextMode =
  CHATBAR_CONTEXT_MODES.FOLLOW_PAGE;

export const CHATBAR_CONTEXT_MODE_STORAGE_KEY = "forge.chatbar.contextMode";

export function normalizeChatbarContextMode(value: unknown): ChatbarContextMode {
  if (value === CHATBAR_CONTEXT_MODES.CHAT_ONLY) return CHATBAR_CONTEXT_MODES.CHAT_ONLY;
  if (value === CHATBAR_CONTEXT_MODES.PINNED_ENTITY) return CHATBAR_CONTEXT_MODES.PINNED_ENTITY;
  if (value === CHATBAR_CONTEXT_MODES.FOLLOW_PAGE) return CHATBAR_CONTEXT_MODES.FOLLOW_PAGE;
  return DEFAULT_CHATBAR_CONTEXT_MODE;
}

export function loadChatbarContextMode(): ChatbarContextMode {
  if (typeof window === "undefined") return DEFAULT_CHATBAR_CONTEXT_MODE;
  try {
    return normalizeChatbarContextMode(
      localStorage.getItem(CHATBAR_CONTEXT_MODE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_CHATBAR_CONTEXT_MODE;
  }
}

export function saveChatbarContextMode(mode: ChatbarContextMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CHATBAR_CONTEXT_MODE_STORAGE_KEY,
      normalizeChatbarContextMode(mode),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function contextModeLabel(mode: ChatbarContextMode): string {
  switch (mode) {
    case CHATBAR_CONTEXT_MODES.CHAT_ONLY:
      return "Chat only";
    case CHATBAR_CONTEXT_MODES.PINNED_ENTITY:
      return "Pinned";
    case CHATBAR_CONTEXT_MODES.FOLLOW_PAGE:
    default:
      return "Follow page";
  }
}
