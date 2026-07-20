"use client";

import { Plus, RefreshCw } from "lucide-react";
import { DesktopWindowControls } from "@/components/desktop/DesktopWindowControls";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { FORGE_TABS_MAX } from "@/lib/forge-tabs";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { NotificationBell } from "./NotificationBell";
import { useForgeTabs } from "./ForgeTabProvider";
import { useShell } from "./ShellContext";
import { StageExplorerFoundation, StageExplorerOps } from "./StageExplorer";
import { useForgeStage } from "./StageProvider";

const OPS_ROOMS = ["map", "monitor", "automate"] as const;

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
  // Multi-tab strip owns the notification bell + window controls (top-right).
  // Keep them here when the strip is hidden so they stay on the topmost chrome row.
  const tabStripVisible = tabsEnabled && tabs.length > 1;
  const atMax = tabs.length >= FORGE_TABS_MAX;
  // Right dotted bridge only when MMA exists — otherwise it terminates into a blank slot
  const hasOpsRooms = OPS_ROOMS.some((room) => isRoomUnlocked(room));
  const showBell = !tabStripVisible;
  // Frameless desktop: this row is the drag region only when it is the topmost chrome.
  const isTopmostChrome = !tabStripVisible;

  return (
    <header
      className={[
        "app-topbar shrink-0 bg-bg",
        isTopmostChrome ? "desktop-drag-region" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="app-topbar__inner">
        {/*
          Leading half: [business picker] ··· [Foundation] ···
          Foundation is always centered in the free space (equal flex on both sides).
          Right side paints dots only when MMA rooms are unlocked — otherwise an
          invisible spacer keeps balance without a line into blank space.
        */}
        <div className="app-topbar__leading desktop-no-drag">
          <div className="app-topbar__workspace">
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
        <div className="app-topbar__stages desktop-no-drag">
          {hasOpsRooms ? (
            <div className="app-topbar__bridge" aria-hidden="true" />
          ) : null}
          <StageExplorerOps />
          {hasOpsRooms ? (
            <div className="app-topbar__bridge-spacer" aria-hidden="true" />
          ) : null}
        </div>

        {/* Trailing actions — equal 1fr track balances the leading half */}
        <div className="app-topbar__actions desktop-no-drag">
          {showHermesModelSwitcher && (
            <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          )}
          {/*
            Bell lives on the multi-tab strip when visible; otherwise here.
            Workshop refresh sits on this room-navbar row, under the multi-tab
            bell column (or beside the bell when the strip is hidden).
          */}
          {workshopRefreshAvailable ? (
            <button
              type="button"
              className="app-topbar__refresh"
              onClick={() => requestWorkshopRefresh()}
              title="Refresh workshop"
              aria-label="Refresh workshop"
            >
              <RefreshCw aria-hidden strokeWidth={1.5} />
            </button>
          ) : null}
          {showBell ? <NotificationBell /> : null}
          {/* Window controls only on the topmost chrome row (not under the tab strip) */}
          {isTopmostChrome ? <DesktopWindowControls /> : null}
        </div>
      </div>
    </header>
  );
}
