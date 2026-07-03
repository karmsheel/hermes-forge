"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GitBranch, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { Conversation } from "@/lib/types";

interface ConversationsMenuProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  processId: string;
  onSelect: (id: string) => void;
  onForked?: () => void;
}

export function ConversationsMenu({
  conversations,
  activeConversationId,
  processId,
  onSelect,
  onForked,
}: ConversationsMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const [forking, setForking] = useState<string | null>(null);
  const [forkTitle, setForkTitle] = useState("");
  const [forkingFrom, setForkingFrom] = useState<string | null>(null);

  const active = conversations.find((c) => c.id === activeConversationId);
  const activeTitle = active?.title || "Main";

  async function handleFork(sourceConversationId: string) {
    setForking(sourceConversationId);
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
      toast.success(`Forked "${newConv.title}" from "${activeTitle}"`);
      setForkingFrom(null);
      setForkTitle("");
      onForked?.();
      if (newConv.id) onSelect(newConv.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fork conversation");
    } finally {
      setForking(null);
    }
  }

  if (conversations.length <= 1) {
    // Single conversation — show a compact fork button
    return (
      <div className="flex items-center gap-1.5">
        <GitBranch className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs text-text-muted truncate max-w-[120px]">{activeTitle}</span>
        <button
          type="button"
          onClick={() => setForkingFrom(activeConversationId)}
          disabled={!!forking}
          className="p-1 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text"
          title="Fork this conversation"
        >
          {forking === activeConversationId ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
        </button>
        {forkingFrom === activeConversationId && (
          <ForkInline
            title={forkTitle}
            onTitleChange={setForkTitle}
            onCancel={() => {
              setForkingFrom(null);
              setForkTitle("");
            }}
            onSubmit={() => handleFork(activeConversationId!)}
            submitting={!!forking}
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
        <GitBranch className="w-3.5 h-3.5" />
        <span className="truncate max-w-[120px]">{activeTitle}</span>
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-border bg-bg-elevated shadow-md p-1.5 space-y-0.5">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div key={conv.id}>
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
                    <span className="text-[10px] text-text-faint">{conv._count.messages}</span>
                  )}
                  {conv.forkedFromId && (
                    <span className="text-[10px] text-accent" title="Forked">⎇</span>
                  )}
                </div>
                {isActive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForkingFrom(conv.id);
                    }}
                    disabled={!!forking}
                    className="w-full text-left px-2 py-1 text-[10px] text-text-muted hover:text-accent flex items-center gap-1"
                  >
                    {forking === conv.id ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Plus className="w-2.5 h-2.5" />
                    )}
                    Fork from here
                  </button>
                )}
                {forkingFrom === conv.id && (
                  <ForkInline
                    title={forkTitle}
                    onTitleChange={setForkTitle}
                    onCancel={() => {
                      setForkingFrom(null);
                      setForkTitle("");
                    }}
                    onSubmit={() => handleFork(conv.id)}
                    submitting={!!forking}
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

function ForkInline({
  title,
  onTitleChange,
  onCancel,
  onSubmit,
  submitting,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        className="input text-[11px] py-0.5 px-1.5 flex-1 min-w-0"
        placeholder="Fork title..."
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
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
        Fork
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
