"use client";

import { Plus, RefreshCw } from "lucide-react";
import { DesktopWindowControls } from "@/components/desktop/DesktopWindowControls";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { FORGE_TABS_MAX } from "@/lib/forge-tabs";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { NavThemeModeToggle } from "./NavThemeModeToggle";
import { NotificationBell } from "./NotificationBell";
import { useForgeTabs } from "./ForgeTabProvider";
import { useShell } from "./ShellContext";
import { OPS_ROOMS } from "@/lib/forge-stage";
import { StageExplorerFoundation, StageExplorerOps } from "./StageExplorer";
import { useForgeStage } from "./StageProvider";

export function AppTopBar() {
  const {
    openHermesConnection,
    workshopRefreshAvailable,
    requestWorkshopRefresh,
  } = useShell();
  const { showHermesModelSwitcher } = useDeveloperSettings();
  const { enabled: tabsEnabled, tabs, createTab } = useForgeTabs();
  const { isRoomUnlocked } = useForgeStage();

  // When the tab strip is hidden, still allow opening a second tab from the top bar
  const showNewTab = tabsEnabled && tabs.length <= 1;
  // Multi-tab strip owns theme toggle + notification bell + window controls (top-right).
  // Keep them here when the strip is hidden so they stay on the topmost chrome row.
  const tabStripVisible = tabsEnabled && tabs.length > 1;
  const atMax = tabs.length >= FORGE_TABS_MAX;
  // Right dotted bridge only when MMA exists — otherwise it terminates into a blank slot
  const hasOpsRooms = OPS_ROOMS.some((room) => isRoomUnlocked(room));
  const showTrailingChrome = !tabStripVisible;
  // Frameless desktop: this row is the drag region only when it is the topmost chrome.
  const isTopmostChrome = !tabStripVisible;

  return (
    <header
      className={[
        "app-topbar shrink-0",
        isTopmostChrome ? "desktop-drag-region" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="app-topbar__inner">
        {/*
          Leading: [picker] ··· [Foundation | Inventory] ···
          Only interactive islands use desktop-no-drag so bridges / empty flex
          remain window-drag surfaces on the frameless desktop shell.
        */}
        <div className="app-topbar__leading">
          <div className="app-topbar__workspace desktop-no-drag">
            <BusinessSwitcher />
            {showNewTab ? (
              <button
                type="button"
                className="app-topbar__new-tab"
                onClick={() => createTab()}
                disabled={atMax}
                title={atMax ? `Maximum ${FORGE_TABS_MAX} tabs` : "New tab (Ctrl+T)"}
                aria-label="New tab"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <div className="app-topbar__foundation-slot">
            <div className="app-topbar__bridge" aria-hidden="true" />
            <StageExplorerFoundation />
            {/* Equal flex balance on the right; dotted only once MMA rooms exist */}
            <div
              className={
                hasOpsRooms ? "app-topbar__bridge" : "app-topbar__bridge-spacer"
              }
              aria-hidden="true"
            />
          </div>
        </div>

        {/*
          MMA center track (fixed width). When ops rooms exist, equal flex on both
          sides keeps the pill centered; the left side is a dotted bridge so the
          line from Foundation continues all the way to the pill edge (no gap).
        */}
        <div className="app-topbar__stages">
          {hasOpsRooms ? (
            <div className="app-topbar__bridge" aria-hidden="true" />
          ) : null}
          <StageExplorerOps />
          {hasOpsRooms ? (
            <div className="app-topbar__bridge-spacer" aria-hidden="true" />
          ) : null}
        </div>

        {/* Trailing actions — equal 1fr track balances the leading half; empty
            space left of the controls stays a drag region. */}
        <div className="app-topbar__actions">
          {showHermesModelSwitcher && (
            <div className="desktop-no-drag">
              <HermesModelSwitcher onOpenConnection={openHermesConnection} />
            </div>
          )}
          {/*
            Theme + bell live on the multi-tab strip when visible; otherwise here.
            Workshop refresh sits on this room-navbar row, under the multi-tab
            chrome column (or beside them when the strip is hidden).
          */}
          {workshopRefreshAvailable ? (
            <button
              type="button"
              className="app-topbar__refresh desktop-no-drag"
              onClick={() => requestWorkshopRefresh()}
              title="Refresh workshop"
              aria-label="Refresh workshop"
            >
              <RefreshCw aria-hidden strokeWidth={1.5} />
            </button>
          ) : null}
          {showTrailingChrome ? (
            <div className="desktop-no-drag">
              <NavThemeModeToggle className="theme-mode-toggle--chrome" />
            </div>
          ) : null}
          {showTrailingChrome ? (
            <div className="desktop-no-drag">
              <NotificationBell />
            </div>
          ) : null}
          {/* Window controls only on the topmost chrome row (not under the tab strip) */}
          {isTopmostChrome ? <DesktopWindowControls /> : null}
        </div>
      </div>
    </header>
  );
}
