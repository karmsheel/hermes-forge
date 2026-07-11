/**
 * Process-scoped chat binding for the global chatbar (4.17 PR-5).
 * Workshop registers this while a process is active; chatbar renders process chat
 * instead of studio threads. Unregister on leave / no selection.
 */

import type { ChatMessage, Conversation } from "@/lib/types";
import type { Mentionable } from "@/components/workshop/rich-composer/parse";
import type { MermaidNodeInfo } from "@/components/workshop/MermaidDiagram";
import type { QueuedMessage } from "@/lib/message-queue";

/** Minimal comment summary used by the diagram dots (from ProcessChat). */
export type ProcessCommentSummary = {
  firstLabel: string;
  count: number;
  firstMessageId?: string;
  lastMessageId?: string;
};

export type ProcessSessionBinding = {
  processId: string;
  processName: string;
  conversationId: string | null;
  conversations: Conversation[];
  messages: ChatMessage[];
  isLoading: boolean;
  agentBusyLabel?: string | null;
  queuedMessages?: ReadonlyArray<QueuedMessage>;
  selectedNode?: MermaidNodeInfo | null;
  mentionables?: ReadonlyArray<Mentionable>;
  composerFocusKey?: number;
  scrollToRequest?: { key: number; label: string | null } | null;
  onSend: (
    content: string,
    options?: { nodeContext?: { nodeId?: string; label: string } },
  ) => void;
  onSelectConversation: (conversationId: string) => void;
  onForked?: () => void;
  onRemoveQueued?: (id: string) => void;
  onClearQueue?: () => void;
  onClearNodeContext?: () => void;
  onSlashCommand?: (command: string, args: string) => boolean;
  onCommentsChange?: (comments: Map<string, ProcessCommentSummary>) => void;
  onOpenConnection: () => void;
};

export function isProcessSessionBinding(
  value: unknown,
): value is ProcessSessionBinding {
  if (!value || typeof value !== "object") return false;
  const v = value as ProcessSessionBinding;
  return (
    typeof v.processId === "string" &&
    v.processId.length > 0 &&
    typeof v.processName === "string" &&
    typeof v.onSend === "function" &&
    typeof v.onSelectConversation === "function" &&
    typeof v.onOpenConnection === "function" &&
    Array.isArray(v.messages)
  );
}
