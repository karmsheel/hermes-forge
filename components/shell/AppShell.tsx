"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChatbarCollapsedTab } from "@/components/chatbar/ChatbarCollapsedTab";
import { ChatbarPanel } from "@/components/chatbar/ChatbarPanel";
import { ChatbarProvider, useChatbar } from "@/components/chatbar/ChatbarProvider";
import { AppTopBar } from "./AppTopBar";
import { NavRail } from "./NavRail";
import { ShellProvider } from "./ShellContext";

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOpen, isLeft, side } = useChatbar();
  const isBusinessManager = pathname.startsWith("/business-manager");
  const isWorkshop = pathname.startsWith("/workshop");
  const isAutomation = pathname.startsWith("/automations");
  const isGodMode = pathname.startsWith("/god-mode");
  const isHome = pathname === "/home";
  const layoutClass = [
    "app-shell-layout",
    isOpen && "app-shell-layout--chat-open",
    !isOpen && "app-shell-layout--chat-collapsed",
    `app-shell-layout--chat-side-${side}`,
    isBusinessManager && "app-shell-layout--business-manager",
    (isWorkshop || isAutomation || isGodMode) && "app-shell-layout--full",
    isHome && "app-shell-layout--home",
  ]
    .filter(Boolean)
    .join(" ");

  const chat = <ChatbarPanel key="chatbar" />;
  const edgeTab = <ChatbarCollapsedTab key="chatbar-tab" />;

  if (isBusinessManager) {
    return (
      <div className={layoutClass}>
        {isLeft ? chat : null}
        <div className="app-shell-layout__content">{children}</div>
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
        <AppTopBar />
        <div className="app-shell-layout__content">{children}</div>
      </div>
      {!isLeft ? chat : null}
      {edgeTab}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <ChatbarProvider>
        <AppShellFrame>{children}</AppShellFrame>
      </ChatbarProvider>
    </ShellProvider>
  );
}
