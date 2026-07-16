"use client";

import { Plus } from "lucide-react";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { FORGE_TABS_MAX } from "@/lib/forge-tabs";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { NotificationBell } from "./NotificationBell";
import { useForgeTabs } from "./ForgeTabProvider";
import { useShell } from "./ShellContext";
import { StageExplorer } from "./StageExplorer";

export function AppTopBar() {
  const { openHermesConnection } = useShell();
  const { showHermesModelSwitcher } = useDeveloperSettings();
  const { enabled: tabsEnabled, tabs, createTab } = useForgeTabs();

  // When the tab strip is hidden, still allow opening a second tab from the top bar
  const showNewTab = tabsEnabled && tabs.length <= 1;
  const atMax = tabs.length >= FORGE_TABS_MAX;

  return (
    <header className="app-topbar shrink-0 bg-bg">
      <div className="app-topbar__inner">
        {/* Business picker (+ optional new tab) */}
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

        {/* Dotted connector: picker → room switcher (own grid track so it always has width) */}
        <div className="app-topbar__bridge" aria-hidden="true" />

        {/* Room switcher (Foundation | Map | Monitor | Automate) */}
        <div className="app-topbar__stages">
          <StageExplorer />
        </div>

        {/* Trailing actions */}
        <div className="app-topbar__actions">
          {showHermesModelSwitcher && (
            <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          )}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
