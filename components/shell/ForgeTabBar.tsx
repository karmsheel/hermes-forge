"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { Copy, PanelLeftClose, Plus, Trash2, X } from "lucide-react";
import { FORGE_TABS_MAX } from "@/lib/forge-tabs";
import { useForgeTabs } from "./ForgeTabProvider";

function businessInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

type ContextMenuState = {
  tabId: string;
  x: number;
  y: number;
};

export function ForgeTabBar() {
  const {
    enabled,
    tabs,
    activeTabId,
    createTab,
    closeTab,
    closeOtherTabs,
    duplicateTab,
    reorderTabs,
    activateTab,
    unloadSession,
    isSessionUnloaded,
  } = useForgeTabs();

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const onNew = useCallback(() => {
    createTab();
  }, [createTab]);

  useEffect(() => {
    if (!menu) return;
    function onDown(e: globalThis.MouseEvent) {
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

  if (!enabled || tabs.length === 0) return null;

  const atMax = tabs.length >= FORGE_TABS_MAX;
  const menuTab = menu ? tabs.find((t) => t.id === menu.tabId) : null;

  return (
    <div className="forge-tab-bar" role="tablist" aria-label="Open sessions">
      <div className="forge-tab-bar__scroll">
        {tabs.map((tab, index) => {
          const active = tab.id === activeTabId;
          const unloaded = isSessionUnloaded(tab.id);
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              draggable
              className={[
                "forge-tab-bar__tab",
                active ? " is-active" : "",
                unloaded ? " is-unloaded" : "",
                dragOver === index ? " is-drag-over" : "",
                dragFrom === index ? " is-dragging" : "",
              ].join("")}
              title={unloaded ? `${tab.title} (session unloaded)` : tab.title}
              onClick={() => activateTab(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              onMouseDown={(e: MouseEvent) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activateTab(tab.id);
                }
              }}
              onDragStart={(e: DragEvent) => {
                setDragFrom(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", tab.id);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== index) setDragOver(index);
              }}
              onDragLeave={() => {
                if (dragOver === index) setDragOver(null);
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                const from = dragFrom;
                setDragFrom(null);
                setDragOver(null);
                if (from == null || from === index) return;
                reorderTabs(from, index);
              }}
            >
              <span className="forge-tab-bar__initial" aria-hidden>
                {businessInitial(tab.businessName)}
              </span>
              <span className="forge-tab-bar__title">{tab.title}</span>
              {unloaded ? (
                <span className="forge-tab-bar__badge" title="Session unloaded">
                  ·
                </span>
              ) : null}
              <button
                type="button"
                className="forge-tab-bar__close"
                title="Close tab"
                aria-label={`Close ${tab.title}`}
                disabled={tabs.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="forge-tab-bar__new"
        onClick={onNew}
        disabled={atMax}
        title={atMax ? `Maximum ${FORGE_TABS_MAX} tabs` : "New tab (Ctrl+T)"}
        aria-label="New tab"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {menu && menuTab ? (
        <div
          ref={menuRef}
          className="forge-tab-bar__menu"
          role="menu"
          style={{ top: menu.y, left: menu.x }}
        >
          <button
            type="button"
            role="menuitem"
            className="forge-tab-bar__menu-item"
            onClick={() => {
              setMenu(null);
              duplicateTab(menuTab.id);
            }}
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="forge-tab-bar__menu-item"
            disabled={tabs.length <= 1}
            onClick={() => {
              setMenu(null);
              closeOtherTabs(menuTab.id);
            }}
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
            Close others
          </button>
          <button
            type="button"
            role="menuitem"
            className="forge-tab-bar__menu-item"
            disabled={menuTab.id === activeTabId || isSessionUnloaded(menuTab.id)}
            onClick={() => {
              setMenu(null);
              unloadSession(menuTab.id);
            }}
            title="Free memory by unmounting this workshop session"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Unload session
          </button>
          <button
            type="button"
            role="menuitem"
            className="forge-tab-bar__menu-item forge-tab-bar__menu-item--danger"
            disabled={tabs.length <= 1}
            onClick={() => {
              setMenu(null);
              closeTab(menuTab.id);
            }}
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
