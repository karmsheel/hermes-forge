"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ListPlus,
  Loader2,
  Navigation,
  Send,
  Square,
} from "lucide-react";
import type { ComposerControlState } from "@/lib/chatbar/composer-state";
import { composerKeyAction } from "@/lib/chatbar/composer-state";
import { NodeContextPill } from "@/components/workshop/DiagramComments";
import {
  filterMentionables,
  filterSlashCommands,
  findSlashCommand,
  type SlashCommandDescriptor,
} from "@/components/workshop/rich-composer/commands";
import { getCaretCoordinates } from "@/components/workshop/rich-composer/caret";
import {
  parseMessage,
  type Mentionable,
} from "@/components/workshop/rich-composer/parse";
import {
  SuggestionPopover,
  type SuggestionItem,
} from "@/components/workshop/rich-composer/SuggestionPopover";
import { ChatbarModelSelect } from "./ChatbarDesktopBar";

/** Alias used by page modules / plan interfaces. */
export type SlashCommandSpec = SlashCommandDescriptor;

type Mode = "idle" | "mention" | "slash";

const POPOVER_MAX_WIDTH = 288;

export type ChatbarComposerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Optional text override when slash expands before send. */
  onSubmit: (text?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** Rows for the textarea (studio default 5). */
  rows?: number;
  /** Optional external ref for focus (studio ChatbarPanel). */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  modelSelectId?: string;

  /** Page/context pills above the input (e.g. process selection). */
  selectionPills?: ReactNode;

  /** Workshop node target pill. */
  selectedNode?: { label: string } | null;
  onClearNode?: () => void;

  /** When non-empty (or enableRichTokens), @ mentions are available. */
  mentionables?: ReadonlyArray<Mentionable>;
  /**
   * Enable / and @ suggestion UX. Defaults true when mentionables provided
   * or onSlashCommand is set; false for plain studio pages.
   */
  enableRichTokens?: boolean;
  onSlashCommand?: (command: string, args: string) => boolean;
  /**
   * When rich tokens are on and user submits, optional parse hook so parents
   * can expand slash handlers before send. Return false to cancel send.
   */
  onBeforeSubmit?: (text: string) => string | false;

  composerState: ComposerControlState;
  onStop?: () => void;
  onSteer?: () => void;
  onQueue?: () => void;
  willQueue?: boolean;
  isLoading?: boolean;
  /** Extra busy-state input for keyboard FSM (studio). */
  sending?: boolean;
  canSteer?: boolean;
  className?: string;
};

function detectMode(
  nextValue: string,
  caret: number,
): { mode: Mode; q: string; start: number | null } {
  const leadMatch = nextValue.match(/^(\s*)\/(\S*)$/);
  if (leadMatch && caret <= leadMatch[0].length) {
    return { mode: "slash", q: leadMatch[2], start: leadMatch[1].length };
  }
  let i = caret - 1;
  while (i >= 0) {
    const ch = nextValue[i];
    if (ch === "@") {
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
}

/**
 * Unified chatbar composer: studio chrome (box + model + stop/steer/queue/send)
 * with optional @ mentions and / slash commands for Workshop-style pages.
 */
export function ChatbarComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask about this page or your business…",
  ariaLabel = "Message Hermes",
  rows = 5,
  textareaRef: externalRef,
  modelSelectId = "chatbar-model-studio",
  selectionPills,
  selectedNode,
  onClearNode,
  mentionables = [],
  enableRichTokens,
  onSlashCommand,
  onBeforeSubmit,
  composerState,
  onStop,
  onSteer,
  onQueue,
  willQueue = false,
  isLoading = false,
  sending = false,
  canSteer = false,
  className,
}: ChatbarComposerProps) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalRef ?? internalRef;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rich =
    enableRichTokens === true ||
    (enableRichTokens !== false &&
      (mentionables.length > 0 || Boolean(onSlashCommand)));

  const [mode, setMode] = useState<Mode>("idle");
  const [query, setQuery] = useState("");
  const [queryStart, setQueryStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const items: SuggestionItem[] = useMemo(() => {
    if (!rich || mode === "idle") return [];
    if (mode === "slash") {
      return filterSlashCommands(query).map((c) => ({
        key: c.command,
        label: `/${c.command}${c.argHint ? ` ${c.argHint}` : ""}`,
        description: c.description,
        badge: "command",
      }));
    }
    return filterMentionables(mentionables, query).map((m) => ({
      key: `${m.kind}:${m.ref ?? m.label}`,
      label: m.label,
      description: m.description ?? (m.ref ? `${m.kind} • ${m.ref}` : m.kind),
      badge: m.kind,
    }));
  }, [rich, mode, query, mentionables]);

  useLayoutEffect(() => {
    if (!rich) return;
    const ta = textareaRef.current;
    if (!ta || mode === "idle" || queryStart == null) {
      setAnchor(null);
      return;
    }

    const updateAnchor = () => {
      const el = textareaRef.current;
      if (!el) return;
      const coords = getCaretCoordinates(el, queryStart + 1 + query.length);
      if (!coords) {
        setAnchor(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const localX = Math.max(
        8,
        Math.min(coords.x, el.clientWidth - POPOVER_MAX_WIDTH - 8),
      );
      setAnchor({
        x: rect.left + localX,
        y: rect.top + Math.max(0, coords.y) + (coords.height || 16),
      });
    };

    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [rich, mode, queryStart, query, value, textareaRef]);

  const acceptSuggestion = useCallback(
    (item: SuggestionItem) => {
      const ta = textareaRef.current;
      if (!ta || queryStart == null) return;
      const caret = ta.selectionStart ?? value.length;
      const before = value.slice(0, queryStart);
      const after = value.slice(caret);
      let insertText: string;
      if (mode === "slash") {
        const cmdName = item.label.replace(/^\//, "").split(/\s/)[0];
        insertText = `/${cmdName} `;
      } else {
        const needsQuoting = /\s/.test(item.label);
        insertText = needsQuoting ? `@"${item.label}" ` : `@${item.label} `;
      }
      const newValue = before + insertText + after;
      const newCaret = (before + insertText).length;
      onChange(newValue);
      setMode("idle");
      setQuery("");
      setQueryStart(null);
      setActiveIndex(0);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newCaret, newCaret);
      });
    },
    [mode, queryStart, value, onChange, textareaRef],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      const caret = e.target.selectionStart ?? next.length;
      onChange(next);
      if (!rich) return;
      const detected = detectMode(next, caret);
      setMode(detected.mode);
      setQuery(detected.q);
      setQueryStart(detected.start);
      setActiveIndex(0);
    },
    [onChange, rich],
  );

  const runSubmit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;

    if (rich && onBeforeSubmit) {
      const next = onBeforeSubmit(text);
      if (next === false) {
        onChange("");
        setMode("idle");
        setQuery("");
        setQueryStart(null);
        return;
      }
      if (typeof next === "string" && next !== text) {
        onChange(next);
        onSubmit(next);
        return;
      }
    }

    if (rich) {
      const parsed = parseMessage(text, mentionables);
      if (parsed.slash) {
        const cmd = findSlashCommand(parsed.slash.command);
        if (cmd?.handler) {
          const expanded = cmd.handler(parsed.slash.args);
          if (expanded) {
            onChange(expanded);
            onSubmit(expanded);
            return;
          }
        } else if (onSlashCommand) {
          const handled = onSlashCommand(parsed.slash.command, parsed.slash.args);
          if (handled) {
            onChange("");
            setMode("idle");
            setQuery("");
            setQueryStart(null);
            return;
          }
        }
      }
    }

    onSubmit(text);
  }, [
    value,
    disabled,
    rich,
    onBeforeSubmit,
    onChange,
    onSubmit,
    mentionables,
    onSlashCommand,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (rich && mode !== "idle" && items.length > 0) {
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

      const action = composerKeyAction(
        {
          key: e.key,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          isComposing: e.nativeEvent.isComposing,
        },
        { sending, draftText: value, canSteer },
      );
      if (action === "none") return;
      e.preventDefault();
      if (action === "submit" || action === "send") {
        runSubmit();
        return;
      }
      if (action === "steer") {
        onSteer?.();
        return;
      }
      if (action === "queue") {
        onQueue?.();
      }
    },
    [
      rich,
      mode,
      items,
      activeIndex,
      acceptSuggestion,
      sending,
      value,
      canSteer,
      runSubmit,
      onSteer,
      onQueue,
    ],
  );

  const sendDisabled =
    composerState.controls.inlineSend.disabled ||
    !value.trim() ||
    disabled ||
    (!willQueue && isLoading);

  return (
    <div
      ref={containerRef}
      className={["chatbar-panel__composer-row", className].filter(Boolean).join(" ")}
    >
      {selectedNode && onClearNode ? (
        <div className="mb-1">
          <NodeContextPill label={selectedNode.label} onClear={onClearNode} />
        </div>
      ) : null}

      <div className="chatbar-panel__composer-box">
        {selectionPills ? (
          <div
            className="chatbar-panel__composer-pills"
            role="status"
            title="Included in Hermes context for this chat"
          >
            {selectionPills}
          </div>
        ) : null}
        <div className="relative">
          <textarea
            id="chatbar-input"
            ref={textareaRef as RefObject<HTMLTextAreaElement>}
            className="chatbar-panel__composer-input chatbar-panel__composer-input--live chatbar-panel__composer-input--in-box"
            rows={rows}
            value={value}
            disabled={disabled}
            aria-label={ariaLabel}
            placeholder={placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {rich ? (
            <SuggestionPopover
              open={
                mode !== "idle" &&
                (mode === "slash" ? true : mentionables.length > 0)
              }
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
          ) : null}
        </div>
      </div>

      <div className="chatbar-panel__composer-toolbar">
        <ChatbarModelSelect
          disabled={disabled}
          id={modelSelectId}
          className="chatbar-panel__composer-model"
        />
        <div className="chatbar-panel__composer-actions chatbar-panel__composer-actions--row">
          {!composerState.controls.stop.hidden ? (
            <button
              type="button"
              className="chatbar-panel__stop"
              disabled={composerState.controls.stop.disabled}
              onClick={onStop}
              title={composerState.controls.stop.label || "Stop"}
              aria-label={composerState.controls.stop.label || "Stop Hermes"}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : null}
          {!composerState.controls.steer.hidden ? (
            <button
              type="button"
              className="chatbar-panel__steer"
              disabled={composerState.controls.steer.disabled || disabled}
              onClick={() => onSteer?.()}
              title={composerState.controls.steer.label || "Steer"}
              aria-label={composerState.controls.steer.label || "Steer run"}
            >
              <Navigation className="w-4 h-4" />
            </button>
          ) : null}
          {!composerState.controls.queue.hidden ? (
            <button
              type="button"
              className="chatbar-panel__queue"
              disabled={composerState.controls.queue.disabled || disabled}
              onClick={() => onQueue?.()}
              title={composerState.controls.queue.label || "Queue"}
              aria-label={composerState.controls.queue.label || "Queue message"}
            >
              <ListPlus className="w-4 h-4" />
            </button>
          ) : null}
          {!composerState.controls.inlineSend.hidden ? (
            <button
              type="button"
              className="chatbar-panel__send"
              disabled={sendDisabled}
              onClick={runSubmit}
              title={willQueue ? "Queue message" : "Send (Enter)"}
              aria-label={willQueue ? "Queue message" : "Send message"}
            >
              {willQueue ? (
                <ListPlus className="w-3.5 h-3.5" aria-hidden />
              ) : isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="w-3.5 h-3.5" aria-hidden />
              )}
              {willQueue ? "Queue" : "Send"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
