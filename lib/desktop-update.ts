"use client";

import { useEffect, useState } from "react";
import type { DesktopUpdateStatus } from "@/lib/desktop-update-types";
import { isForgeDesktop } from "@/lib/forge-desktop";

const IDLE_STATUS: DesktopUpdateStatus = {
  phase: "idle",
  currentVersion: "0.0.0",
  version: null,
  releaseNotes: null,
  progress: null,
  error: null,
};

export function useDesktopUpdate() {
  const [status, setStatus] = useState<DesktopUpdateStatus>(IDLE_STATUS);

  useEffect(() => {
    if (!isForgeDesktop() || !window.forgeDesktop?.getUpdateStatus) return;

    let cancelled = false;

    void window.forgeDesktop.getUpdateStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      if (next.phase === "idle" || next.phase === "not-available") {
        void window.forgeDesktop?.checkForUpdates?.().then((fresh) => {
          if (!cancelled) setStatus(fresh);
        });
      }
    });

    const unsubscribe = window.forgeDesktop.onUpdateStatus?.((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return status;
}

export async function checkDesktopUpdate() {
  if (!window.forgeDesktop?.checkForUpdates) return IDLE_STATUS;
  return window.forgeDesktop.checkForUpdates();
}

export async function downloadDesktopUpdate() {
  if (!window.forgeDesktop?.downloadUpdate) return IDLE_STATUS;
  return window.forgeDesktop.downloadUpdate();
}

export function installDesktopUpdate() {
  window.forgeDesktop?.installUpdate?.();
}