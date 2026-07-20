"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Hammer } from "lucide-react";
import { ChatbarCollapsedTab } from "@/components/chatbar/ChatbarCollapsedTab";
import { ChatbarPanel } from "@/components/chatbar/ChatbarPanel";
import { ChatbarProvider, useChatbar } from "@/components/chatbar/ChatbarProvider";
import { DesktopDragChrome } from "@/components/desktop/DesktopDragChrome";
import { OverlordRequiredGate } from "@/components/overlord/OverlordRequiredGate";
import { isForgeDesktop } from "@/lib/forge-desktop";
import { AppTopBar } from "./AppTopBar";
import { ForgeTabBar } from "./ForgeTabBar";
import { ForgeTabOutlet } from "./ForgeTabOutlet";
import { ForgeTabProvider, useForgeTabs } from "./ForgeTabProvider";
import { NavRail } from "./NavRail";
import { ShellProvider } from "./ShellContext";
import { StageProvider } from "./StageProvider";

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOpen, isLeft, side } = useChatbar();
  const { enabled: tabsEnabled, tabs } = useForgeTabs();
  const tabStripVisible = tabsEnabled && tabs.length > 1;
  const [desktop, setDesktop] = useState(false);
  const isBusinessManager = pathname.startsWith("/business-manager");
  const isSetup = pathname.startsWith("/setup");
  /** Overlord / first-run setup: introduce the product without the chat surface. */
  const hideChatbar = isSetup;
  const isFullBleed = isBusinessManager || isSetup;
  const isWorkshop = pathname.startsWith("/workshop");
  const isAutomation = pathname.startsWith("/automations");
  const isGodMode = pathname.startsWith("/god-mode");
  const isFoundation = pathname.startsWith("/foundation");
  const isHome =
    pathname === "/home" ||
    pathname === "/home-combined" ||
    pathname === "/map/home" ||
    pathname === "/monitor/home" ||
    pathname === "/automate/home";
  const chatOpen = isOpen && !hideChatbar;

  useEffect(() => {
    setDesktop(isForgeDesktop());
  }, []);

  const layoutClass = [
    "app-shell-layout",
    chatOpen && "app-shell-layout--chat-open",
    !chatOpen && "app-shell-layout--chat-collapsed",
    `app-shell-layout--chat-side-${side}`,
    isFullBleed && "app-shell-layout--business-manager",
    (isWorkshop || isAutomation || isGodMode || isFoundation) &&
      "app-shell-layout--full",
    isHome && "app-shell-layout--home",
    tabsEnabled && "app-shell-layout--tabs",
    tabStripVisible && "app-shell-layout--tab-strip",
    desktop && "app-shell-layout--desktop-chrome",
  ]
    .filter(Boolean)
    .join(" ");

  const chat = hideChatbar ? null : <ChatbarPanel key="chatbar" />;
  const edgeTab = hideChatbar ? null : <ChatbarCollapsedTab key="chatbar-tab" />;

  if (isFullBleed) {
    return (
      <div className={layoutClass}>
        <div className="app-shell-layout__main app-shell-layout__main--full-bleed">
          {/*
            Full-width title strip. Business Manager: theme + notifications top-right
            (same as multi-tab chrome); always shown on web. Other full-bleed (setup):
            desktop drag + window controls only.
            BM also shows a plain-line hammer (current page, non-interactive) —
            ForgeTabBar is not mounted on full-bleed surfaces.
          */}
          <DesktopDragChrome
            always={isBusinessManager}
            showShellActions={isBusinessManager}
          >
            {isBusinessManager ? (
              <span
                className="forge-tab-bar__home forge-tab-bar__home--current desktop-no-drag"
                title="Business Manager"
                aria-label="Business Manager"
                aria-current="page"
              >
                <span className="forge-tab-bar__home-mark" aria-hidden>
                  <Hammer className="forge-tab-bar__home-icon" strokeWidth={2} />
                </span>
              </span>
            ) : null}
          </DesktopDragChrome>
          <div className="app-shell-layout__body">
            {isLeft ? chat : null}
            <div className="app-shell-layout__content">
              <ForgeTabOutlet>{children}</ForgeTabOutlet>
            </div>
            {!isLeft ? chat : null}
          </div>
        </div>
        {edgeTab}
      </div>
    );
  }

  return (
    <div className={layoutClass}>
      {/*
        Full-bleed multi-tab title strip (window controls top-right).
        Nav rail lives in the row BELOW so its top aligns with the strip bottom.
      */}
      <ForgeTabBar />
      <div className="app-shell-layout__row">
        <NavRail />
        <div className="app-shell-layout__main">
          {/*
            Chat docks beside the room navbar + page column so its top aligns with
            the business picker / room pills — left dock shifts that column right.
          */}
          <div className="app-shell-layout__body">
            {isLeft ? chat : null}
            <div className="app-shell-layout__workspace">
              <AppTopBar />
              <div className="app-shell-layout__content">
                <ForgeTabOutlet>{children}</ForgeTabOutlet>
              </div>
            </div>
            {!isLeft ? chat : null}
          </div>
        </div>
        {edgeTab}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <StageProvider>
        <ChatbarProvider>
          <ForgeTabProvider>
            <OverlordRequiredGate />
            <AppShellFrame>{children}</AppShellFrame>
          </ForgeTabProvider>
        </ChatbarProvider>
      </StageProvider>
    </ShellProvider>
  );
}
