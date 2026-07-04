"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { useShell } from "./ShellContext";

export function AppTopBar() {
  const { user, userLoading, openHermesConnection } = useShell();

  return (
    <header className="app-topbar shrink-0 border-b border-border bg-bg">
      <div className="app-topbar__inner">
        <BusinessSwitcher />

        <div className="flex-1 min-w-0" />

        <div className="flex items-center gap-3 text-sm">
          <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          <HermesStatusBadge onClick={openHermesConnection} />
          {!userLoading && user && (
            <Link
              href="/profile"
              className="text-text-muted hover:text-text-strong flex items-center gap-1 max-w-[12rem] truncate"
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">{user.name || "Local"}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}