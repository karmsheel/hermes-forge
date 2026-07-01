"use client";

import Link from "next/link";
import { Building2, LogOut, User } from "lucide-react";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { useShell } from "./ShellContext";

export function AppTopBar() {
  const { user, userLoading, currentBusiness, openBusinessSwitcher, openHermesConnection, logout } = useShell();

  return (
    <header className="app-topbar shrink-0 border-b border-border bg-bg">
      <div className="app-topbar__inner">
        <button
          type="button"
          onClick={openBusinessSwitcher}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-strong max-w-[240px] truncate pr-3"
          title="Switch business"
        >
          <Building2 className="w-4 h-4 shrink-0 text-accent" />
          <span className="truncate font-medium">
            {currentBusiness?.name || "Select business"}
          </span>
        </button>

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
              <span className="truncate">{user.name || user.email}</span>
            </Link>
          )}
          <button
            onClick={() => void logout()}
            className="text-text-muted hover:text-text-strong flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}