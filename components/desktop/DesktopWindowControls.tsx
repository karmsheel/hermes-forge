"use client";

import { useCallback, useEffect, useState } from "react";
import { isForgeDesktop, maximizeToggleWindow, minimizeWindow, closeWindow } from "@/lib/forge-desktop";
import { useWindowMaximized } from "@/lib/use-window-maximized";

/**
 * Windows-style caption buttons for the frameless desktop shell.
 * Only mounts when `window.forgeDesktop` is present (SSR-safe).
 */
export function DesktopWindowControls() {
  const [mounted, setMounted] = useState(false);
  const maximized = useWindowMaximized();

  useEffect(() => {
    setMounted(true);
  }, []);

  const onMinimize = useCallback(() => {
    void minimizeWindow();
  }, []);

  const onMaximizeToggle = useCallback(() => {
    void maximizeToggleWindow();
  }, []);

  const onClose = useCallback(() => {
    void closeWindow();
  }, []);

  if (!mounted || !isForgeDesktop()) return null;

  return (
    <div className="desktop-window-controls desktop-no-drag" role="group" aria-label="Window">
      <button
        type="button"
        className="desktop-window-controls__btn"
        onClick={onMinimize}
        title="Minimize"
        aria-label="Minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>
      <button
        type="button"
        className="desktop-window-controls__btn"
        onClick={onMaximizeToggle}
        title={maximized ? "Restore" : "Maximize"}
        aria-label={maximized ? "Restore" : "Maximize"}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path
              d="M2.5 3.5h5v5h-5zM3.5 2.5h5v1M8.5 2.5v5h-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <rect
              x="1.2"
              y="1.2"
              width="7.6"
              height="7.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="desktop-window-controls__btn desktop-window-controls__btn--close"
        onClick={onClose}
        title="Close"
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.15" />
        </svg>
      </button>
    </div>
  );
}
