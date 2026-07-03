"use client";

/**
 * DiagramComments / node targeting helpers for 3.2
 *
 * Provides three things used across the workshop:
 *
 *   - NodeContextPill: a chip shown in the chat composer area when a node
 *     is selected (user clicked a node, hasn't yet deselected).
 *
 *   - NodeCommentDot: a small absolutely-positioned badge overlay rendered
 *     next to a Mermaid node that has user comments. Clicking it scrolls
 *     the chat to the first matching message and briefly highlights it.
 *
 *   - NodeCommentBadge: a small label shown at the top of a chat bubble
 *     that targets a specific node. Replaces the inline "Regarding X:" prefix
 *     with a clean visual so the user's actual comment text is the focus.
 *
 * The wire format is a regular chat message prefixed with `Regarding "X": …`.
 * The companion helpers in `lib/node-comment.ts` build/parse the prefix.
 */

import { MapPin, MessageCircle } from "lucide-react";

export type NodeInfo = {
  id?: string;
  label: string;
};

interface NodeContextPillProps {
  label: string;
  onClear: () => void;
}

export function NodeContextPill({ label, onClear }: NodeContextPillProps) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-2 py-0.5 text-[10px]">
      <span className="text-accent">Node:</span>
      <span className="font-medium truncate max-w-[200px]">{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-text-muted hover:text-text-strong px-1"
        aria-label="Clear node target"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Small chip rendered at the top of a chat bubble that targets a node.
 * Replaces the raw `Regarding "X":` prefix with a clear visual.
 */
export function NodeCommentBadge({ label }: { label: string }) {
  return (
    <div className="mb-1 inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accent">
      <MapPin className="w-3 h-3" />
      <span className="truncate max-w-[200px]">{label}</span>
    </div>
  );
}

/**
 * Small absolutely-positioned badge overlay rendered next to a Mermaid node
 * that has user comments. Renders as an HTML `<button>` outside the SVG so
 * it never interferes with Mermaid's layout.
 *
 * Position is supplied by the parent (typically derived from
 * `svgEl.getBBox()` or `getBoundingClientRect()`).
 */
export function NodeCommentDot({
  count,
  x,
  y,
  onActivate,
}: {
  count: number;
  x: number;
  y: number;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      title={`${count} comment${count === 1 ? "" : "s"}`}
      className="absolute z-10 flex items-center justify-center rounded-full bg-accent text-bg shadow-md hover:scale-110 transition-transform"
      style={{
        left: x,
        top: y,
        width: 18,
        height: 18,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        // The button's anchor is its top-left; shift so the dot centres on (x, y).
        transform: "translate(-50%, -50%)",
      }}
      aria-label={`${count} comment${count === 1 ? "" : "s"} on this step`}
    >
      {count > 9 ? "9+" : count}
    </button>
  );
}

/** Re-export the MessageCircle icon for callers that want it. */
export { MessageCircle };
