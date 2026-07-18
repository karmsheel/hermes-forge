"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChatbarCollapsedTab } from "@/components/chatbar/ChatbarCollapsedTab";
import { ChatbarPanel } from "@/components/chatbar/ChatbarPanel";
import { ChatbarProvider, useChatbar } from "@/components/chatbar/ChatbarProvider";
import { OverlordRequiredGate } from "@/components/overlord/OverlordRequiredGate";
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
  const isBusinessManager = pathname.startsWith("/business-manager");
  const isSetup = pathname.startsWith("/setup");
  const isFullBleed = isBusinessManager || isSetup;
  const isWorkshop = pathname.startsWith("/workshop");
  const isAutomation = pathname.startsWith("/automations");
  const isGodMode = pathname.startsWith("/god-mode");
  const isFoundation = pathname.startsWith("/foundation");
  const isHome = pathname === "/home";
  const layoutClass = [
    "app-shell-layout",
    isOpen && "app-shell-layout--chat-open",
    !isOpen && "app-shell-layout--chat-collapsed",
    `app-shell-layout--chat-side-${side}`,
    isFullBleed && "app-shell-layout--business-manager",
    (isWorkshop || isAutomation || isGodMode || isFoundation) &&
      "app-shell-layout--full",
    isHome && "app-shell-layout--home",
    tabsEnabled && "app-shell-layout--tabs",
    tabStripVisible && "app-shell-layout--tab-strip",
  ]
    .filter(Boolean)
    .join(" ");

  const chat = <ChatbarPanel key="chatbar" />;
  const edgeTab = <ChatbarCollapsedTab key="chatbar-tab" />;

  if (isFullBleed) {
    return (
      <div className={layoutClass}>
        {isLeft ? chat : null}
        <div className="app-shell-layout__content">
          <ForgeTabOutlet>{children}</ForgeTabOutlet>
        </div>
        {!isLeft ? chat : null}
        {edgeTab}
      </div>
    );
  }

  return (
    <div className={layoutClass}>
      <NavRail />
      {isLeft ? chat : null}
      <div className="app-shell-layout__main">
        {/* Tabs at top; profile/settings live on NavRail footer */}
        <ForgeTabBar />
        <AppTopBar />
        <div className="app-shell-layout__content">
          <ForgeTabOutlet>{children}</ForgeTabOutlet>
        </div>
      </div>
      {!isLeft ? chat : null}
      {edgeTab}
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
