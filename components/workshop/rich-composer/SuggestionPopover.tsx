"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

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

export type SuggestionAnchor = {
  /** Viewport X (for position:fixed). */
  x: number;
  /** Viewport Y of the caret baseline / line bottom (for position:fixed). */
  y: number;
};

interface SuggestionPopoverProps {
  open: boolean;
  items: SuggestionItem[];
  activeIndex: number;
  onSelect: (item: SuggestionItem) => void;
  onActiveIndexChange: (i: number) => void;
  /** Viewport coordinates of the caret (from getBoundingClientRect + caret offset). */
  anchor: SuggestionAnchor | null;
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = activeItemRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // Measure panel so we can flip below the caret when there isn't room above.
  useEffect(() => {
    if (!open || !panelRef.current) {
      setPanelHeight(0);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setPanelHeight(h);
    });
    ro.observe(panelRef.current);
    setPanelHeight(panelRef.current.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [open, items.length, emptyHint]);

  if (!open || !anchor || !mounted) return null;

  const safeIndex = items.length > 0 ? Math.min(activeIndex, items.length - 1) : -1;

  const gap = 6;
  const maxH = 256; // max-h-64
  const estimatedH = panelHeight || Math.min(maxH, Math.max(40, items.length * 44 + 8));
  const spaceAbove = anchor.y - gap;
  const placeAbove = spaceAbove >= Math.min(estimatedH, 120);

  // Keep list inside the viewport horizontally.
  const maxLeft = typeof window !== "undefined" ? window.innerWidth - 288 - 8 : anchor.x;
  const left = Math.max(8, Math.min(anchor.x, maxLeft));

  const style: CSSProperties = placeAbove
    ? {
        position: "fixed",
        left,
        top: anchor.y - gap,
        transform: "translateY(-100%)",
        zIndex: 80,
      }
    : {
        position: "fixed",
        left,
        top: anchor.y + gap,
        zIndex: 80,
      };

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Suggestions"
      className="w-72 max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-elevated shadow-lg"
      style={style}
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
    </div>,
    document.body
  );
}
