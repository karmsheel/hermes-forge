"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import {
  CHATBAR_EDGE_ALIGNS,
  CHATBAR_EDGE_SAFE_BOTTOM,
  CHATBAR_EDGE_SAFE_TOP,
  edgeOffsetToTopPx,
  topPxToEdgeOffset,
  type ChatbarEdgeAlign,
} from "@/lib/chatbar/residency";
import { useChatbar } from "./ChatbarProvider";

const MENU_MIN_WIDTH = 184;
const MENU_EST_HEIGHT = 248;
const MENU_EDGE = 8;
/** Pixels of pointer travel before a press becomes an edge drag (keeps click-to-open). */
const DRAG_THRESHOLD_PX = 5;

type MenuState = { x: number; y: number };

type DragSession = {
  pointerId: number;
  startClientY: number;
  /** clientY − centerY at pointer down (preserves grab point). */
  grabOffset: number;
  moved: boolean;
};

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
 * Vertical position from edgeOffset (presets + free drag with magnetic snap).
 */
export function ChatbarCollapsedTab() {
  const {
    isOpen,
    open,
    isLeft,
    swapSide,
    edgeAlign,
    edgeOffset,
    setEdgeAlign,
    setEdgeOffset,
    resetEdgePosition,
  } = useChatbar();

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [viewportH, setViewportH] = useState(800);
  /** Live offset while dragging — avoids provider/localStorage churn mid-gesture. */
  const [liveOffset, setLiveOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    function measure() {
      setViewportH(window.innerHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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

  // Release body styles if unmounted mid-drag
  useEffect(() => {
    return () => {
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };
  }, []);

  const displayOffset = liveOffset ?? edgeOffset;
  const topPx = edgeOffsetToTopPx(
    displayOffset,
    viewportH,
    CHATBAR_EDGE_SAFE_TOP,
    CHATBAR_EDGE_SAFE_BOTTOM,
  );

  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu(clampMenuPosition(e.clientX, e.clientY));
  }, []);

  const pickAlign = useCallback(
    (align: Exclude<ChatbarEdgeAlign, "custom">) => {
      setMenu(null);
      setLiveOffset(null);
      setEdgeAlign(align);
    },
    [setEdgeAlign],
  );

  const endDrag = useCallback(
    (session: DragSession, clientY: number) => {
      const centerY = clientY - session.grabOffset;
      const next = topPxToEdgeOffset(
        centerY,
        window.innerHeight,
        CHATBAR_EDGE_SAFE_TOP,
        CHATBAR_EDGE_SAFE_BOTTOM,
      );
      setLiveOffset(null);
      setIsDragging(false);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
      // Snap by default (provider magnetic presets)
      setEdgeOffset(next);
      if (session.moved) {
        suppressClickRef.current = true;
      }
      dragRef.current = null;
    },
    [setEdgeOffset],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      if (menu) {
        setMenu(null);
        return;
      }
      const centerY = edgeOffsetToTopPx(
        edgeOffset,
        window.innerHeight,
        CHATBAR_EDGE_SAFE_TOP,
        CHATBAR_EDGE_SAFE_BOTTOM,
      );
      dragRef.current = {
        pointerId: e.pointerId,
        startClientY: e.clientY,
        grabOffset: e.clientY - centerY,
        moved: false,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers if already released */
      }
    },
    [edgeOffset, menu],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const dy = Math.abs(e.clientY - session.startClientY);
    if (!session.moved) {
      if (dy < DRAG_THRESHOLD_PX) return;
      session.moved = true;
      setIsDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    }

    const centerY = e.clientY - session.grabOffset;
    const next = topPxToEdgeOffset(
      centerY,
      window.innerHeight,
      CHATBAR_EDGE_SAFE_TOP,
      CHATBAR_EDGE_SAFE_BOTTOM,
    );
    setLiveOffset(next);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (session.moved) {
        endDrag(session, e.clientY);
      } else {
        dragRef.current = null;
      }
    },
    [endDrag],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      if (session.moved) {
        endDrag(session, e.clientY);
      } else {
        dragRef.current = null;
        setLiveOffset(null);
        setIsDragging(false);
      }
    },
    [endDrag],
  );

  const onClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (isDragging) return;
    open();
  }, [isDragging, open]);

  if (isOpen) return null;

  const isCustom = edgeAlign === CHATBAR_EDGE_ALIGNS.CUSTOM && liveOffset === null;

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
                aria-checked={edgeAlign === value}
                className={`chatbar-collapsed-tab__menu-item${
                  edgeAlign === value ? " is-active" : ""
                }`}
                onClick={() => pickAlign(value)}
              >
                {label}
              </button>
            ))}
            {isCustom ? (
              <div
                className="chatbar-collapsed-tab__menu-item is-active"
                role="menuitemradio"
                aria-checked="true"
              >
                Custom
              </div>
            ) : null}
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
                setLiveOffset(null);
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
        ref={tabRef}
        type="button"
        className={[
          "chatbar-collapsed-tab",
          `chatbar-collapsed-tab--${isLeft ? "left" : "right"}`,
          isDragging ? "chatbar-collapsed-tab--dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ top: `${topPx}px` }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        title="Open Hermes chat (Alt+H) · Drag to reposition · Right-click for presets"
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
