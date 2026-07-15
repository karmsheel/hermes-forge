"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";

type Props = {
  /** Plain-text page snapshot / agent-visible context. */
  text: string;
  /** Toggle label. */
  label?: string;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Collapsed-by-default dump of what Hermes can see on the current page.
 * Styled like a markdown code fence with a single-line disclosure header.
 */
export function CollapsibleAgentView({
  text,
  label = "What Hermes can see",
  defaultOpen = false,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const trimmed = text.trim();
  if (!trimmed) return null;

  return (
    <div
      className={["chatbar-agent-view", open ? "is-open" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="chatbar-agent-view__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="chatbar-agent-view__toggle-lead" aria-hidden>
          {open ? (
            <ChevronDown className="chatbar-agent-view__icon" />
          ) : (
            <ChevronRight className="chatbar-agent-view__icon" />
          )}
          <Eye className="chatbar-agent-view__icon" />
        </span>
        <span className="chatbar-agent-view__label">{label}</span>
      </button>
      {open ? (
        <pre className="chatbar-agent-view__body" tabIndex={0}>
          {trimmed}
        </pre>
      ) : null}
    </div>
  );
}
