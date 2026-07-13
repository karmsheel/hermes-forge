/**
 * Helpers for process conversation fork (3.4).
 */

/** Messages to copy when forking, optionally cutting at a specific message (inclusive). */
export function messagesToCopyForFork<T extends { id: string }>(
  messages: readonly T[],
  forkAtMessageId?: string | null,
): T[] {
  if (!forkAtMessageId) return [...messages];
  const forkIndex = messages.findIndex((m) => m.id === forkAtMessageId);
  if (forkIndex < 0) return [...messages];
  return messages.slice(0, forkIndex + 1);
}

export function defaultForkTitle(sourceTitle: string, atMessage = false): string {
  const base = sourceTitle?.trim() || "Main";
  return atMessage ? `Fork from message · ${base}` : `Fork of "${base}"`;
}

/** Whether a process conversation may be deleted (always keep at least one). */
export function canDeleteProcessConversation(conversationCount: number): boolean {
  return conversationCount > 1;
}
