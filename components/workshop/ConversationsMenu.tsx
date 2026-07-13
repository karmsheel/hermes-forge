"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { canDeleteProcessConversation } from "@/lib/conversation-fork";
import type { Conversation } from "@/lib/types";

interface ConversationsMenuProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  processId: string;
  onSelect: (id: string) => void;
  /** Called after fork / rename / delete so parent can reload process state. */
  onChanged?: () => void;
  /** @deprecated use onChanged */
  onForked?: () => void;
}

export function ConversationsMenu({
  conversations,
  activeConversationId,
  processId,
  onSelect,
  onChanged,
  onForked,
}: ConversationsMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [forkTitle, setForkTitle] = useState("");
  const [forkingFrom, setForkingFrom] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const active = conversations.find((c) => c.id === activeConversationId);
  const activeTitle = active?.title || "Main";
  const canDelete = canDeleteProcessConversation(conversations.length);

  function notifyChanged() {
    onChanged?.();
    onForked?.();
  }

  async function handleFork(sourceConversationId: string) {
    setBusyId(sourceConversationId);
    try {
      const res = await fetch(`/api/processes/${processId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forkFromConversationId: sourceConversationId,
          title: forkTitle.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fork failed");
      }
      const newConv = await res.json();
      toast.success(`Forked "${newConv.title}"`);
      setForkingFrom(null);
      setForkTitle("");
      setExpanded(false);
      if (newConv.id) onSelect(newConv.id);
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fork conversation");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(conversationId: string) {
    const title = renameTitle.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    setBusyId(conversationId);
    try {
      const res = await fetch(
        `/api/processes/${processId}/conversations/${conversationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Rename failed");
      }
      toast.success("Conversation renamed");
      setRenamingId(null);
      setRenameTitle("");
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(conversationId: string) {
    if (!canDelete) {
      toast.error("Keep at least one conversation");
      return;
    }
    const conv = conversations.find((c) => c.id === conversationId);
    if (
      !window.confirm(
        `Delete conversation "${conv?.title || "Untitled"}"? Messages in this thread will be removed.`,
      )
    ) {
      return;
    }
    setBusyId(conversationId);
    try {
      const res = await fetch(
        `/api/processes/${processId}/conversations/${conversationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      const data = await res.json();
      const remaining: Conversation[] = data.conversations ?? [];
      if (activeConversationId === conversationId) {
        const nextId = remaining[0]?.id;
        if (nextId) onSelect(nextId);
      }
      toast.success("Conversation deleted");
      setExpanded(false);
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  function startRename(conv: Conversation) {
    setRenamingId(conv.id);
    setRenameTitle(conv.title || "");
    setForkingFrom(null);
  }

  const header = (
    <div className="flex items-center gap-1.5 min-w-0">
      <GitBranch className="w-3.5 h-3.5 text-text-muted shrink-0" />
      <span className="text-xs text-text-muted truncate max-w-[140px]" title={activeTitle}>
        {activeTitle}
      </span>
    </div>
  );

  if (conversations.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {header}
        {activeConversationId ? (
          <>
            <button
              type="button"
              onClick={() => {
                const conv = conversations[0];
                if (conv) startRename(conv);
              }}
              disabled={!!busyId}
              className="p-1 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text"
              title="Rename conversation"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setForkingFrom(activeConversationId)}
              disabled={!!busyId}
              className="p-1 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text"
              title="Fork this conversation"
            >
              {busyId === activeConversationId ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </button>
          </>
        ) : null}
        {renamingId && (
          <InlineEdit
            value={renameTitle}
            onChange={setRenameTitle}
            onCancel={() => {
              setRenamingId(null);
              setRenameTitle("");
            }}
            onSubmit={() => handleRename(renamingId)}
            submitting={!!busyId}
            placeholder="Conversation title..."
            submitLabel="Save"
          />
        )}
        {forkingFrom === activeConversationId && (
          <InlineEdit
            value={forkTitle}
            onChange={setForkTitle}
            onCancel={() => {
              setForkingFrom(null);
              setForkTitle("");
            }}
            onSubmit={() => handleFork(activeConversationId!)}
            submitting={!!busyId}
            placeholder="Fork title..."
            submitLabel="Fork"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
      >
        {header}
        <span className="text-[10px] text-text-faint tabular-nums">
          {conversations.length}
        </span>
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-border bg-bg-elevated shadow-md p-1.5 space-y-0.5">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isBusy = busyId === conv.id;
            return (
              <div key={conv.id} className="rounded-lg">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? "bg-bg-muted text-text"
                      : "hover:bg-bg-subtle text-text-muted hover:text-text"
                  }`}
                  onClick={() => {
                    onSelect(conv.id);
                    setExpanded(false);
                  }}
                >
                  <GitBranch className="w-3 h-3 shrink-0" />
                  <span className="text-xs flex-1 truncate">{conv.title}</span>
                  {conv._count && (
                    <span className="text-[10px] text-text-faint">
                      {conv._count.messages}
                    </span>
                  )}
                  {conv.forkedFromId && (
                    <span className="text-[10px] text-accent" title="Forked">
                      ⎇
                    </span>
                  )}
                </div>

                {isActive && renamingId !== conv.id && forkingFrom !== conv.id && (
                  <div className="flex items-center gap-0.5 px-1 pb-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(conv);
                      }}
                      disabled={!!busyId}
                      className="flex-1 text-left px-2 py-1 text-[10px] text-text-muted hover:text-text flex items-center gap-1 rounded-md hover:bg-bg-subtle"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForkingFrom(conv.id);
                        setForkTitle("");
                        setRenamingId(null);
                      }}
                      disabled={!!busyId}
                      className="flex-1 text-left px-2 py-1 text-[10px] text-text-muted hover:text-accent flex items-center gap-1 rounded-md hover:bg-bg-subtle"
                    >
                      {isBusy ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Plus className="w-2.5 h-2.5" />
                      )}
                      Fork
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(conv.id);
                      }}
                      disabled={!!busyId || !canDelete}
                      className="px-2 py-1 text-[10px] text-text-muted hover:text-red disabled:opacity-40 flex items-center gap-1 rounded-md hover:bg-bg-subtle"
                      title={
                        canDelete
                          ? "Delete conversation"
                          : "Keep at least one conversation"
                      }
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}

                {renamingId === conv.id && (
                  <InlineEdit
                    value={renameTitle}
                    onChange={setRenameTitle}
                    onCancel={() => {
                      setRenamingId(null);
                      setRenameTitle("");
                    }}
                    onSubmit={() => handleRename(conv.id)}
                    submitting={isBusy}
                    placeholder="Conversation title..."
                    submitLabel="Save"
                  />
                )}
                {forkingFrom === conv.id && (
                  <InlineEdit
                    value={forkTitle}
                    onChange={setForkTitle}
                    onCancel={() => {
                      setForkingFrom(null);
                      setForkTitle("");
                    }}
                    onSubmit={() => handleFork(conv.id)}
                    submitting={isBusy}
                    placeholder="Fork title..."
                    submitLabel="Fork"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InlineEdit({
  value,
  onChange,
  onCancel,
  onSubmit,
  submitting,
  placeholder,
  submitLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  placeholder: string;
  submitLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 w-full">
      <input
        className="input text-[11px] py-0.5 px-1.5 flex-1 min-w-0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        disabled={submitting}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="btn-primary text-[10px] py-0.5 px-1.5"
      >
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-text-muted hover:text-text px-1 text-xs"
      >
        ×
      </button>
    </div>
  );
}
