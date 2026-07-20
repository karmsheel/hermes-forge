"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DesktopWindowControls } from "@/components/desktop/DesktopWindowControls";
import { isForgeDesktop } from "@/lib/forge-desktop";

type DesktopDragChromeProps = {
  /** Optional content on the left of the drag strip (e.g. empty spacer). */
  children?: ReactNode;
  className?: string;
};

/**
 * Thin top drag strip with window controls for surfaces that do not host
 * ForgeTabBar / AppTopBar (full-bleed shell, startup, sign-in).
 */
export function DesktopDragChrome({ children, className }: DesktopDragChromeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isForgeDesktop()) return null;

  return (
    <div
      className={["desktop-drag-chrome", "desktop-drag-region", className].filter(Boolean).join(" ")}
      aria-hidden={children ? undefined : true}
    >
      <div className="desktop-drag-chrome__lead desktop-no-drag">{children}</div>
      <div className="desktop-drag-chrome__spacer" />
      <DesktopWindowControls />
    </div>
  );
}
