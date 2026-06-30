"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { useShell } from "./ShellContext";

export function AppTopBar() {
  const { user, userLoading, openHermesConnection, logout } = useShell();

  return (
    <header className="app-topbar shrink-0 border-b border-border bg-bg">
      <div className="app-topbar__inner">
        <div className="flex-1 min-w-0" />
        <div className="flex items-center gap-3 text-sm">
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