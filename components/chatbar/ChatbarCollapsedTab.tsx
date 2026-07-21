"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import {
  CHATBAR_EDGE_ALIGNS,
  type ChatbarEdgeAlign,
} from "@/lib/chatbar/residency";
import { useChatbar } from "./ChatbarProvider";

const MENU_MIN_WIDTH = 184;
const MENU_EST_HEIGHT = 220;
const MENU_EDGE = 8;

type MenuState = { x: number; y: number };

function clampMenuPosition(clientX: number, clientY: number): MenuState {
  if (typeof window === "undefined") return { x: clientX, y: clientY };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = clientX;
  let y = clientY;
  if (x + MENU_MIN_WIDTH > vw - MENU_EDGE) {
    x = Math.max(MENU_EDGE, vw - MENU_EDGE - MENU_MIN_WIDTH);
  }
  if (x < MENU_EDGE) x = MENU_EDGE;
  if (y + MENU_EST_HEIGHT > vh - MENU_EDGE) {
    y = Math.max(MENU_EDGE, vh - MENU_EDGE - MENU_EST_HEIGHT);
  }
  if (y < MENU_EDGE) y = MENU_EDGE;
  return { x, y };
}

/**
 * Edge restore control when the chatbar is collapsed.
 * Vertical position: CSS classes top | middle | bottom (from edgeAlign prefs).
 */
export function ChatbarCollapsedTab() {
  const { isOpen, open, isLeft, swapSide, edgeAlign, setEdgeAlign, resetEdgePosition } =
    useChatbar();

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu(clampMenuPosition(e.clientX, e.clientY));
  }, []);

  const pickAlign = useCallback(
    (align: Exclude<ChatbarEdgeAlign, "custom">) => {
      setMenu(null);
      setEdgeAlign(align);
    },
    [setEdgeAlign],
  );

  if (isOpen) return null;

  // Map custom → middle for class purposes (drag deferred; presets only for now)
  const alignClass =
    edgeAlign === CHATBAR_EDGE_ALIGNS.TOP
      ? "chatbar-collapsed-tab--align-top"
      : edgeAlign === CHATBAR_EDGE_ALIGNS.BOTTOM
        ? "chatbar-collapsed-tab--align-bottom"
        : "chatbar-collapsed-tab--align-middle";

  const menuNode =
    menu && mounted
      ? createPortal(
          <div
            ref={menuRef}
            className="chatbar-collapsed-tab__menu desktop-no-drag"
            role="menu"
            style={{ top: menu.y, left: menu.x }}
          >
            <div className="chatbar-collapsed-tab__menu-label" role="presentation">
              Position
            </div>
            {(
              [
                [CHATBAR_EDGE_ALIGNS.TOP, "Top"],
                [CHATBAR_EDGE_ALIGNS.MIDDLE, "Middle"],
                [CHATBAR_EDGE_ALIGNS.BOTTOM, "Bottom"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={
                  edgeAlign === value ||
                  (value === CHATBAR_EDGE_ALIGNS.MIDDLE &&
                    edgeAlign === CHATBAR_EDGE_ALIGNS.CUSTOM)
                }
                className={`chatbar-collapsed-tab__menu-item${
                  edgeAlign === value ||
                  (value === CHATBAR_EDGE_ALIGNS.MIDDLE &&
                    edgeAlign === CHATBAR_EDGE_ALIGNS.CUSTOM)
                    ? " is-active"
                    : ""
                }`}
                onClick={() => pickAlign(value)}
              >
                {label}
              </button>
            ))}
            <div className="chatbar-collapsed-tab__menu-sep" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="chatbar-collapsed-tab__menu-item"
              onClick={() => {
                setMenu(null);
                swapSide();
              }}
            >
              {isLeft ? "Move to right edge" : "Move to left edge"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="chatbar-collapsed-tab__menu-item"
              onClick={() => {
                setMenu(null);
                resetEdgePosition();
              }}
            >
              Reset position
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={[
          "chatbar-collapsed-tab",
          `chatbar-collapsed-tab--${isLeft ? "left" : "right"}`,
          alignClass,
        ].join(" ")}
        onClick={open}
        onContextMenu={onContextMenu}
        title="Open Hermes chat (Alt+H) · Right-click for position"
        aria-label="Open Hermes chat"
      >
        <HermesForgeMark
          variant="tab"
          className="hermes-forge-mark chatbar-collapsed-tab__icon"
        />
      </button>
      {menuNode}
    </>
  );
}
