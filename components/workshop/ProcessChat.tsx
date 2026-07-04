"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import type { ChatMessage } from "@/lib/types";
import {
  RichComposer,
  type Mentionable,
  type ParsedMessage,
} from "./rich-composer/RichComposer";
import { NodeCommentBadge } from "./DiagramComments";
import { MessageQueue } from "./MessageQueue";
import {
  parseNodeComment,
  normaliseLabel,
  serializeNodeCommentSummary,
} from "@/lib/node-comment";
import type { QueuedMessage } from "@/lib/message-queue";
import type { MermaidNodeInfo } from "./MermaidDiagram";

/**
 * Per-node summary of user comments. Computed from the message list each
 * render and emitted to the parent so the diagram can decorate nodes that
 * have user comments.
 */
export interface NodeCommentSummary {
  /** Original (un-normalised) first label we saw for this node. */
  firstLabel: string;
  count: number;
  firstMessageId: string;
  lastMessageId: string;
}

interface ProcessChatProps {
  messages: ChatMessage[];
  processName: string;
  isLoading: boolean;
  /**
   * Send a message. The composer produces a parsed message; we extract the
   * first resolved node mention and pass it as `nodeContext` so the diagram
   * subagent (3.2) can focus the revision. The raw text is sent as `content`.
   */
  onSend: (content: string, options?: { nodeContext?: { nodeId?: string; label: string } }) => void;
  onOpenConnection: () => void;
  /** Increment to focus the composer (e.g. after creating a new process). */
  composerFocusKey?: number;
  /** Current selected node for targeting corrections (3.2). */
  selectedNode?: MermaidNodeInfo | null;
  onClearNodeContext?: () => void;
  /** Diagram nodes surfaced as @-mention candidates. */
  mentionables?: Mentionable[];
  /**
   * Optional hook for slash commands owned by the parent page
   * (e.g. /export switches to the Export tab). Return true to indicate handled.
   */
  onSlashCommand?: (command: string, args: string) => boolean;
  /**
   * Emits a map of normalised node label → comment summary whenever the
   * message list changes. The parent passes this to MermaidDiagram so it
   * can render the per-node comment dots.
   */
  onCommentsChange?: (comments: Map<string, NodeCommentSummary>) => void;
  /**
   * Increments when the parent wants the chat to scroll to a specific node
   * label. Pair with `scrollToNodeLabel` to set the target.
   */
  scrollToRequest?: { key: number; label: string | null } | null;
  /** 3.7: messages waiting to send while agents are busy. */
  queuedMessages?: ReadonlyArray<QueuedMessage>;
  onRemoveQueued?: (id: string) => void;
  onClearQueue?: () => void;
  /** Shown in the queue panel while chat or background agents are running. */
  agentBusyLabel?: string | null;
}

export function ProcessChat({
  messages,
  processName,
  isLoading,
  onSend,
  onOpenConnection,
  composerFocusKey = 0,
  selectedNode,
  onClearNodeContext,
  mentionables,
  onSlashCommand,
  onCommentsChange,
  scrollToRequest,
  queuedMessages = [],
  onRemoveQueued,
  onClearQueue,
  agentBusyLabel,
}: ProcessChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastScrollKey = useRef<number>(0);
  const { isConnected } = useHermesConnection();

  // 3.2: derive per-node comment summary from the message list.
  const commentsByLabel = useMemo(() => {
    const map = new Map<string, NodeCommentSummary>();
    for (const msg of messages) {
      if (msg.role !== "user") continue;
      const parsed = parseNodeComment(msg.content);
      if (!parsed) continue;
      const key = normaliseLabel(parsed.label);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.lastMessageId = msg.id;
      } else {
        map.set(key, {
          firstLabel: parsed.label,
          count: 1,
          firstMessageId: msg.id,
          lastMessageId: msg.id,
        });
      }
    }
    return map;
  }, [messages]);

  const commentsSummaryKey = useMemo(
    () => serializeNodeCommentSummary(commentsByLabel),
    [commentsByLabel],
  );
  const lastCommentsKeyRef = useRef("");

  // Push the summary upward only when content actually changes — not when
  // the parent passes a new messages array with the same data.
  useEffect(() => {
    if (commentsSummaryKey === lastCommentsKeyRef.current) return;
    lastCommentsKeyRef.current = commentsSummaryKey;
    onCommentsChange?.(commentsByLabel);
  }, [commentsByLabel, commentsSummaryKey, onCommentsChange]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 3.2: parent-driven scroll to a specific node's first comment.
  useEffect(() => {
    if (!scrollToRequest || scrollToRequest.label == null) return;
    if (scrollToRequest.key === lastScrollKey.current) return;
    lastScrollKey.current = scrollToRequest.key;
    const key = normaliseLabel(scrollToRequest.label);
    const summary = commentsByLabel.get(key);
    if (!summary) return;
    const el = messageRefs.current.get(summary.firstMessageId);
    if (!el) return;
    // Clear any existing highlight on this message.
    const existing = highlightTimers.current.get(summary.firstMessageId);
    if (existing) clearTimeout(existing);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("node-comment-highlight");
    const t = setTimeout(() => {
      el.classList.remove("node-comment-highlight");
      highlightTimers.current.delete(summary.firstMessageId);
    }, 1800);
    highlightTimers.current.set(summary.firstMessageId, t);
  }, [scrollToRequest, commentsByLabel]);

  function handleComposerSend(parsed: ParsedMessage) {
    // Find the first resolved node mention — that's our 3.2 nodeContext.
    const firstNodeMention = parsed.mentions.find((m) => m.mentionable?.kind === "node");
    const nodeContext = firstNodeMention?.mentionable?.ref
      ? { nodeId: firstNodeMention.mentionable.ref, label: firstNodeMention.mentionable.label }
      : firstNodeMention
        ? { label: firstNodeMention.label }
        : undefined;
    onSend(parsed.raw, { nodeContext });
  }

  function setMessageRef(id: string, el: HTMLDivElement | null) {
    if (el) messageRefs.current.set(id, el);
    else messageRefs.current.delete(id);
  }

  return (
    <div className="flex-1 flex flex-col h-full text-text overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted">Chat</div>
          <div className="text-sm font-medium truncate max-w-[240px]">{processName}</div>
        </div>
        <button
          onClick={onOpenConnection}
          className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong transition-colors"
          title="Hermes connection"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          // 3.2: parse the "Regarding X:" prefix back out of the message so
          // we can render a clean badge instead of the raw text.
          const isUser = msg.role === "user";
          const nodeComment = isUser ? parseNodeComment(msg.content) : null;
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                ref={(el) => setMessageRef(msg.id, el)}
                data-message-id={msg.id}
                className={`chat-message text-sm transition-shadow ${
                  isUser
                    ? "bg-accent text-white"
                    : "bg-bg-elevated border border-border text-text"
                }`}
              >
                {nodeComment && <NodeCommentBadge label={nodeComment.label} />}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {nodeComment ? nodeComment.content : msg.content}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-message bg-bg-elevated border border-border flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Hermes is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        <MessageQueue
          items={queuedMessages}
          busyLabel={agentBusyLabel}
          onRemove={onRemoveQueued ?? (() => {})}
          onClear={onClearQueue}
        />
        <RichComposer
          onSend={handleComposerSend}
          onSlashCommand={onSlashCommand}
          mentionables={mentionables}
          selectedNode={selectedNode}
          onClearNodeContext={onClearNodeContext}
          composerFocusKey={composerFocusKey}
          isLoading={isLoading}
          willQueue={Boolean(agentBusyLabel)}
          isConnected={isConnected}
          onOpenConnection={onOpenConnection}
        />
      </div>
    </div>
  );
}