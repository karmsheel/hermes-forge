"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MessageCircle, PanelTop } from "lucide-react";
import {
  CHATBAR_CONTEXT_MODES,
  contextModeLabel,
  type ChatbarContextMode,
} from "@/lib/chatbar/context-scope";

type Props = {
  mode: ChatbarContextMode;
  onChange: (mode: ChatbarContextMode) => void;
  pageTitle?: string;
  disabled?: boolean;
};

const OPTIONS: {
  mode: ChatbarContextMode;
  description: string;
  icon: typeof MessageCircle;
}[] = [
  {
    mode: CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
    description: "Include page purpose + live snapshot",
    icon: PanelTop,
  },
  {
    mode: CHATBAR_CONTEXT_MODES.CHAT_ONLY,
    description: "Business name only — no page data",
    icon: MessageCircle,
  },
  {
    mode: CHATBAR_CONTEXT_MODES.PINNED_ENTITY,
    description: "Keep a pinned entity while you navigate (limited until PR-5)",
    icon: Crosshair,
  },
];

/**
 * Scope chip: Chat only / Follow page / Pinned (PR-3).
 */
export function ChatbarContextChip({
  mode,
  onChange,
  pageTitle,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label =
    mode === CHATBAR_CONTEXT_MODES.FOLLOW_PAGE && pageTitle
      ? pageTitle
      : contextModeLabel(mode);

  return (
    <div className="chatbar-scope" ref={rootRef}>
      <button
        type="button"
        className={`chatbar-scope__chip${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Context scope — what Hermes can see from this page"
      >
        <PanelTop className="w-3 h-3" aria-hidden />
        <span>{label}</span>
      </button>
      {open ? (
        <div className="chatbar-scope__menu" role="menu">
          <p className="chatbar-scope__menu-label">What Hermes uses</p>
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = opt.mode === mode;
            return (
              <button
                key={opt.mode}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`chatbar-scope__option${active ? " is-active" : ""}`}
                onClick={() => {
                  onChange(opt.mode);
                  setOpen(false);
                }}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
                <span>
                  <strong>{contextModeLabel(opt.mode)}</strong>
                  <em>{opt.description}</em>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
