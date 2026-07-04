"use client";

import { Clock, ListOrdered, X } from "lucide-react";
import type { QueuedMessage } from "@/lib/message-queue";
import { parseNodeComment } from "@/lib/node-comment";
import { NodeCommentBadge } from "./DiagramComments";

interface MessageQueueProps {
  items: ReadonlyArray<QueuedMessage>;
  /** Shown when agents are running but the queue is empty. */
  busyLabel?: string | null;
  onRemove: (id: string) => void;
  onClear?: () => void;
}

function previewText(content: string): string {
  const parsed = parseNodeComment(content);
  const body = parsed ? parsed.content : content;
  const singleLine = body.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 120) return singleLine;
  return `${singleLine.slice(0, 117)}…`;
}

function nodeLabel(item: QueuedMessage): string | null {
  if (item.nodeContext?.label) return item.nodeContext.label;
  const parsed = parseNodeComment(item.content);
  return parsed?.label ?? null;
}

export function MessageQueue({ items, busyLabel, onRemove, onClear }: MessageQueueProps) {
  const showPanel = items.length > 0 || Boolean(busyLabel);
  if (!showPanel) return null;

  return (
    <div className="message-queue" role="region" aria-label="Queued messages">
      <div className="message-queue__header">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-muted">
          {items.length > 0 ? (
            <>
              <ListOrdered className="w-3 h-3" aria-hidden />
              <span>Queued ({items.length})</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" aria-hidden />
              <span>Agents running</span>
            </>
          )}
        </div>
        {items.length > 1 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="message-queue__clear text-[10px] text-text-muted hover:text-text"
          >
            Clear all
          </button>
        )}
      </div>

      {busyLabel && (
        <p className="message-queue__status text-[11px] text-amber flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-amber rounded-full animate-pulse shrink-0" />
          {busyLabel}
        </p>
      )}

      {items.length > 0 && (
        <ul className="message-queue__list">
          {items.map((item, index) => {
            const label = nodeLabel(item);
            return (
              <li key={item.id} className="message-queue__item">
                <span className="message-queue__index" aria-hidden>
                  {index + 1}
                </span>
                <div className="message-queue__body min-w-0">
                  {label && <NodeCommentBadge label={label} />}
                  <p className="message-queue__preview">{previewText(item.content)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="message-queue__remove"
                  aria-label={`Remove queued message ${index + 1}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}