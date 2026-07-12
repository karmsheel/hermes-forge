"use client";

import Link from "next/link";
import { Plus, User } from "lucide-react";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { SettingsMenu } from "@/components/settings/SettingsMenu";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { FORGE_TABS_MAX } from "@/lib/forge-tabs";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { NavThemeModeToggle } from "./NavThemeModeToggle";
import { NotificationBell } from "./NotificationBell";
import { useForgeTabs } from "./ForgeTabProvider";
import { useShell } from "./ShellContext";
import { StageExplorer } from "./StageExplorer";

export function AppTopBar() {
  const { user, userLoading, openHermesConnection } = useShell();
  const { showHermesModelSwitcher } = useDeveloperSettings();
  const { enabled: tabsEnabled, tabs, createTab } = useForgeTabs();

  // Multi-tab strip (2+) hosts profile/settings/theme; single-tab or web keeps them here
  const tabStripVisible = tabsEnabled && tabs.length > 1;
  const showAccountChrome = !tabStripVisible;
  // When the tab strip is hidden, still allow opening a second tab from the top bar
  const showNewTab = tabsEnabled && tabs.length <= 1;
  const atMax = tabs.length >= FORGE_TABS_MAX;

  return (
    <header className="app-topbar shrink-0 bg-bg">
      <div className="app-topbar__inner">
        {/* Column 1 — leading edge (left of the top bar) */}
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

        {/* Column 2 — stage explorer (Map | Monitor | Automate) */}
        <div className="app-topbar__stages">
          <StageExplorer />
        </div>

        {/* Column 3 — trailing edge */}
        <div className="app-topbar__actions">
          {showHermesModelSwitcher && (
            <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          )}
          <NotificationBell />
          {showAccountChrome && (
            <NavThemeModeToggle className="app-topbar__theme-toggle" />
          )}
          {showAccountChrome && !userLoading && user && (
            <Link
              href="/profile"
              className="app-topbar__profile"
              title={user.name || "Profile"}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="app-topbar__profile-name">{user.name || "Local"}</span>
            </Link>
          )}
          {showAccountChrome && (
            <div className="app-topbar__settings-wrap">
              <SettingsMenu className="app-topbar__settings" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
