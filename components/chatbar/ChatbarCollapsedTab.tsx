"use client";

import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { useChatbar } from "./ChatbarProvider";

/**
 * Edge restore control when the chatbar is collapsed.
 * Sits on the same side as the dock (right or left of the content).
 * Brand mark matches Business Manager / nav rail (HermesForgeMark).
 */
export function ChatbarCollapsedTab() {
  const { isOpen, open, isLeft } = useChatbar();
  if (isOpen) return null;

  return (
    <button
      type="button"
      className={`chatbar-collapsed-tab chatbar-collapsed-tab--${isLeft ? "left" : "right"}`}
      onClick={open}
      title="Open Hermes chat (Alt+H)"
      aria-label="Open Hermes chat"
    >
      <HermesForgeMark className="hermes-forge-mark chatbar-collapsed-tab__icon" />
    </button>
  );
}
