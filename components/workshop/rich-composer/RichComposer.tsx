"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Send, Loader2, AtSign, Command, ListPlus } from "lucide-react";
import { NodeContextPill } from "@/components/workshop/DiagramComments";
import type { MermaidNodeInfo } from "@/components/workshop/MermaidDiagram";
import { filterMentionables, filterSlashCommands, SLASH_COMMANDS, findSlashCommand } from "./commands";
import { getCaretCoordinates } from "./caret";
import { parseMessage, type Mentionable, type ParsedMessage } from "./parse";
import { SuggestionPopover, type SuggestionItem } from "./SuggestionPopover";
import { buildNodeCommentPrefix } from "@/lib/node-comment";

type Mode = "idle" | "mention" | "slash";

export interface RichComposerProps {
  /** Called with the parsed message when the user submits. */
  onSend: (parsed: ParsedMessage) => void;

  /** Optional hook for slash commands that the parent owns (e.g. /export). */
  onSlashCommand?: (command: string, args: string) => boolean;

  /** Items the user can @-mention (e.g. nodes from the current diagram). */
  mentionables?: ReadonlyArray<Mentionable>;

  /** Existing 3.2 behavior — keep auto-prefixing "Regarding X:" on node select. */
  selectedNode?: MermaidNodeInfo | null;
  onClearNodeContext?: () => void;

  /** Bump to programmatically focus the composer. */
  composerFocusKey?: number;

  /** True while a chat reply is in flight (shows thinking indicator). */
  isLoading?: boolean;
  /** When true, Send queues the message instead of blocking the composer. */
  willQueue?: boolean;
  isConnected?: boolean;
  onOpenConnection?: () => void;

  /** Cosmetic. */
  placeholder?: string;
}

const POPOVER_MAX_WIDTH = 288; // matches w-72 in the popover

export function RichComposer({
  onSend,
  onSlashCommand,
  mentionables = [],
  selectedNode,
  onClearNodeContext,
  composerFocusKey = 0,
  isLoading = false,
  willQueue = false,
  isConnected = true,
  onOpenConnection,
  placeholder = "Describe steps, actors, tools… try / for commands or @ for people, roles, or steps",
}: RichComposerProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [query, setQuery] = useState("");
  const [queryStart, setQueryStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedNodeRef = useRef<MermaidNodeInfo | null>(null);

  // Focus the textarea on demand.
  useEffect(() => {
    if (!composerFocusKey) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [composerFocusKey]);

  // 3.2 backward-compat: auto-prefix "Regarding X:" when a node is selected.
  // useLayoutEffect so the prefix is set before paint, avoiding a visible flash.
  useLayoutEffect(() => {
    if (!selectedNode) return;
    const newPrefix = buildNodeCommentPrefix(selectedNode.label);
    // The setState below is a one-shot derived update from the selectedNode
    // prop change — not a cascade trigger. Disable the rule locally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue((current) => {
      if (!current.trim()) return newPrefix;
      const existingMatch = current.match(/^Regarding "[^"]+": /);
      if (existingMatch) return newPrefix + current.slice(existingMatch[0].length);
      return current;
    });
    prevSelectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  // Same pattern for deselect-strip.
  useLayoutEffect(() => {
    if (selectedNode) return;
    const prev = prevSelectedNodeRef.current;
    if (!prev) return;
    const oldPrefix = buildNodeCommentPrefix(prev.label);
    setValue((current) => (current.startsWith(oldPrefix) ? current.slice(oldPrefix.length) : current));
  }, [selectedNode]);

  // Compute the candidate list for the current mode.
  const items: SuggestionItem[] = useMemo(() => {
    if (mode === "slash") {
      return filterSlashCommands(query).map((c) => ({
        key: c.command,
        label: `/${c.command}${c.argHint ? ` ${c.argHint}` : ""}`,
        description: c.description,
        badge: "command",
      }));
    }
    if (mode === "mention") {
      return filterMentionables(mentionables, query).map((m) => ({
        key: `${m.kind}:${m.ref ?? m.label}`,
        label: m.label,
        description: m.ref ? `${m.kind} • ${m.ref}` : m.kind,
        badge: m.kind,
      }));
    }
    return [];
  }, [mode, query, mentionables]);

  // Recompute the popover anchor when mode/text/caret changes. The state set
  // here is a pure measurement update and re-runs only when the caret or text
  // changes — there is no cascading render in practice.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta || mode === "idle" || queryStart == null) {
      setAnchor(null);
      return;
    }
    const coords = getCaretCoordinates(ta, queryStart + 1 + query.length);
    if (!coords) {
      setAnchor(null);
      return;
    }
    // Clamp so the popover stays inside the textarea's right edge.
    const maxX = ta.clientWidth - POPOVER_MAX_WIDTH - 8;
    setAnchor({ x: Math.max(8, Math.min(coords.x, maxX)), y: coords.y });
  }, [mode, queryStart, query, value]);

  // Detect mode from the current value + caret.
  const detectMode = useCallback((nextValue: string, caret: number): { mode: Mode; q: string; start: number | null } => {
    // Slash: only at start (allowing leading whitespace).
    const leadMatch = nextValue.match(/^(\s*)\/(\S*)$/);
    if (leadMatch && caret <= leadMatch[0].length) {
      return { mode: "slash", q: leadMatch[2], start: leadMatch[1].length };
    }
    // Mention: scan backwards from caret for an unmatched @ that's at a
    // token boundary and has no whitespace after it.
    let i = caret - 1;
    while (i >= 0) {
      const ch = nextValue[i];
      if (ch === "@") {
        // Must be at a token start.
        const prev = i > 0 ? nextValue[i - 1] : " ";
        if (/\s/.test(prev) || i === 0) {
          return { mode: "mention", q: nextValue.slice(i + 1, caret), start: i };
        }
        return { mode: "idle", q: "", start: null };
      }
      if (/\s/.test(ch)) return { mode: "idle", q: "", start: null };
      i--;
    }
    return { mode: "idle", q: "", start: null };
  }, []);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      const caret = e.target.selectionStart ?? next.length;
      setValue(next);
      const detected = detectMode(next, caret);
      setMode(detected.mode);
      setQuery(detected.q);
      setQueryStart(detected.start);
      setActiveIndex(0);
    },
    [detectMode],
  );

  // Accept a suggestion — replace the active query with the chosen label.
  const acceptSuggestion = useCallback(
    (item: SuggestionItem) => {
      const ta = textareaRef.current;
      if (!ta || queryStart == null) return;
      const caret = ta.selectionStart ?? value.length;
      // Replacement: from queryStart to caret.
      const before = value.slice(0, queryStart);
      const after = value.slice(caret);
      let insertText: string;
      if (mode === "slash") {
        // Replace "/<query>" with "/<command> " (and let user type args)
        const cmdName = item.label.replace(/^\//, "").split(/\s/)[0];
        insertText = `/${cmdName} `;
      } else {
        // Mention: if the label has whitespace, use quoted form for fidelity.
        const needsQuoting = /\s/.test(item.label);
        insertText = needsQuoting ? `@"${item.label}" ` : `@${item.label} `;
      }
      const newValue = before + insertText + after;
      const newCaret = (before + insertText).length;
      setValue(newValue);
      setMode("idle");
      setQuery("");
      setQueryStart(null);
      setActiveIndex(0);
      // Restore caret on next tick.
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newCaret, newCaret);
      });
    },
    [mode, queryStart, value],
  );

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || (isLoading && !willQueue)) return;
    const parsed = parseMessage(text, mentionables);

    // Built-in slash commands with a handler expand the text before sending.
    let outgoing = text;
    if (parsed.slash) {
      const cmd = findSlashCommand(parsed.slash.command);
      if (cmd?.handler) {
        const expanded = cmd.handler(parsed.slash.args);
        if (expanded) outgoing = expanded;
      } else if (onSlashCommand) {
        const handled = onSlashCommand(parsed.slash.command, parsed.slash.args);
        if (handled) {
          // Parent handled it (e.g. switched to Export tab). Don't send.
          setValue("");
          setMode("idle");
          setQuery("");
          setQueryStart(null);
          return;
        }
      }
    }

    onSend(parseMessage(outgoing, mentionables));
    setValue("");
    setMode("idle");
    setQuery("");
    setQueryStart(null);
  }, [value, isLoading, willQueue, mentionables, onSend, onSlashCommand]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Popover keyboard nav.
      if (mode !== "idle" && items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % items.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + items.length) % items.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          acceptSuggestion(items[Math.min(activeIndex, items.length - 1)]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMode("idle");
          setQuery("");
          setQueryStart(null);
          return;
        }
      }
      // Plain send on Enter.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [mode, items, activeIndex, acceptSuggestion, handleSend],
  );

  const showHelper = value === "";

  return (
    <div ref={containerRef} className="relative">
      {!isConnected && onOpenConnection && (
        <div className="mb-2 text-xs pill pill-amber rounded-lg px-3 py-2">
          <button type="button" onClick={onOpenConnection} className="hover:underline">
            Connect to Hermes
          </button>{" "}
          to start chatting.
        </div>
      )}
      {selectedNode && onClearNodeContext && (
        <NodeContextPill label={selectedNode.label} onClear={onClearNodeContext} />
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            className="input composer-input w-full resize-none min-h-[44px] max-h-32 text-sm"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <SuggestionPopover
            open={mode !== "idle" && (mode === "slash" ? true : mentionables.length > 0)}
            items={items}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={acceptSuggestion}
            anchor={anchor}
            emptyHint={
              mode === "slash"
                ? `No command matches "${query}". Press Esc to cancel.`
                : "No steps to mention yet. Add a step to the diagram first."
            }
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!value.trim() || (!willQueue && isLoading) || !isConnected}
          className="btn-primary self-end"
          aria-label={willQueue ? "Queue message" : "Send message"}
          title={willQueue ? "Queue message" : "Send message"}
        >
          {willQueue ? (
            <ListPlus className="w-4 h-4" />
          ) : isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {showHelper && (
        <p className="text-[10px] text-text-soft mt-2 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" /> type <kbd className="font-mono">/</kbd> for commands
          </span>
          <span className="flex items-center gap-1">
            <AtSign className="w-3 h-3" /> type <kbd className="font-mono">@</kbd> to mention a step
          </span>
          <span>
            <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
          </span>
        </p>
      )}
    </div>
  );
}

// Re-export so the parent doesn't need to know about the parser internals.
export { SLASH_COMMANDS };
export type { Mentionable, ParsedMessage };
