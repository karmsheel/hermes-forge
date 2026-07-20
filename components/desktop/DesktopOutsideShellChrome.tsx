"use client";

import { usePathname } from "next/navigation";
import { DesktopDragChrome } from "@/components/desktop/DesktopDragChrome";

/** Routes rendered outside `app/(shell)` — need their own drag + window controls. */
const OUTSIDE_SHELL_PREFIXES = ["/", "/login", "/sign-in", "/signup"] as const;

function isOutsideShell(pathname: string): boolean {
  if (pathname === "/") return true;
  return OUTSIDE_SHELL_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

/**
 * Mounts drag chrome for auth / startup when the shell layout is not present.
 * No-ops on web and inside the main app shell.
 */
export function DesktopOutsideShellChrome() {
  const pathname = usePathname() || "/";
  if (!isOutsideShell(pathname)) return null;
  return <DesktopDragChrome className="desktop-drag-chrome--outside-shell" />;
}
