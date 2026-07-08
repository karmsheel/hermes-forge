"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppTopBar } from "./AppTopBar";
import { NavRail } from "./NavRail";
import { ShellProvider } from "./ShellContext";

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBusinessManager = pathname.startsWith("/business-manager");
  const isWorkshop = pathname.startsWith("/workshop");
  const isAutomation = pathname.startsWith("/automations");
  const isGodMode = pathname.startsWith("/god-mode");
  const isHome = pathname === "/home";
  const layoutClass = [
    "app-shell-layout",
    isBusinessManager && "app-shell-layout--business-manager",
    (isWorkshop || isAutomation || isGodMode) && "app-shell-layout--full",
    isHome && "app-shell-layout--home",
  ]
    .filter(Boolean)
    .join(" ");

  if (isBusinessManager) {
    return (
      <div className={layoutClass}>
        <div className="app-shell-layout__content">{children}</div>
      </div>
    );
  }

  return (
    <div className={layoutClass}>
      <NavRail />
      <div className="app-shell-layout__main">
        <AppTopBar />
        <div className="app-shell-layout__content">{children}</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </ShellProvider>
  );
}