"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DesktopWindowControls } from "@/components/desktop/DesktopWindowControls";
import { NavThemeModeToggle } from "@/components/shell/NavThemeModeToggle";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { isForgeDesktop } from "@/lib/forge-desktop";

type DesktopDragChromeProps = {
  /** Optional content on the left of the drag strip (e.g. empty spacer). */
  children?: ReactNode;
  className?: string;
  /**
   * Show day/night toggle + notifications on the trailing edge
   * (Business Manager title strip).
   */
  showShellActions?: boolean;
  /**
   * Always render the strip (web + desktop). Default: desktop-only drag chrome.
   * Business Manager uses this so theme/bell stay top-right on web too.
   */
  always?: boolean;
};

/**
 * Thin top drag strip with window controls for surfaces that do not host
 * ForgeTabBar / AppTopBar (full-bleed shell, startup, sign-in).
 * Optional shell actions match multi-tab title-bar trailing chrome.
 */
export function DesktopDragChrome({
  children,
  className,
  showShellActions = false,
  always = false,
}: DesktopDragChromeProps) {
  const [mounted, setMounted] = useState(false);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDesktop(isForgeDesktop());
  }, []);

  if (!mounted) return null;
  if (!always && !desktop) return null;

  return (
    <div
      className={[
        "desktop-drag-chrome",
        desktop ? "desktop-drag-region" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={children || showShellActions ? undefined : true}
    >
      <div className="desktop-drag-chrome__lead desktop-no-drag">{children}</div>
      <div className="desktop-drag-chrome__spacer" />
      {showShellActions ? (
        <div className="desktop-drag-chrome__actions desktop-no-drag">
          <NavThemeModeToggle className="theme-mode-toggle--chrome" />
          <NotificationBell />
        </div>
      ) : null}
      {desktop ? <DesktopWindowControls /> : null}
    </div>
  );
}
