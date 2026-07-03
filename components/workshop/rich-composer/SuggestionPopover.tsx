"use client";

import { useEffect, useRef } from "react";

export interface SuggestionItem {
  /** Stable key. */
  key: string;
  /** Display label (the first line). */
  label: string;
  /** Optional second-line description. */
  description?: string;
  /** Small icon/badge text. */
  badge?: string;
}

interface SuggestionPopoverProps {
  open: boolean;
  items: SuggestionItem[];
  activeIndex: number;
  onSelect: (item: SuggestionItem) => void;
  onActiveIndexChange: (i: number) => void;
  /** Position of the popover, relative to the textarea. */
  anchor: { x: number; y: number } | null;
  /** Empty-state hint when no matches. */
  emptyHint?: string;
}

export function SuggestionPopover({
  open,
  items,
  activeIndex,
  onSelect,
  onActiveIndexChange,
  anchor,
  emptyHint = "No matches",
}: SuggestionPopoverProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = activeItemRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open || !anchor) return null;

  // Clamp the active index to a valid range.
  const safeIndex = items.length > 0 ? Math.min(activeIndex, items.length - 1) : -1;

  return (
    <div
      role="listbox"
      aria-label="Suggestions"
      className="absolute z-30 w-72 max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-elevated shadow-lg"
      style={{ left: anchor.x, top: anchor.y + 18 }}
      onMouseDown={(e) => {
        // Prevent the textarea from blurring when the user clicks an item.
        e.preventDefault();
      }}
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-text-soft">{emptyHint}</div>
      ) : (
        <ul ref={listRef} className="py-1">
          {items.map((item, i) => {
            const active = i === safeIndex;
            return (
              <li
                key={item.key}
                ref={active ? activeItemRef : undefined}
                role="option"
                aria-selected={active}
                onMouseEnter={() => onActiveIndexChange(i)}
                onClick={() => onSelect(item)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm ${
                  active ? "bg-bg-subtle" : "hover:bg-bg-subtle"
                }`}
              >
                {item.badge && (
                  <span className="text-[10px] uppercase font-mono tracking-wider text-accent shrink-0 w-12">
                    {item.badge}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-text">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-text-soft truncate">{item.description}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
