"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import iconImage from "@/assets/icon.jpg";
import { DesktopUpdateDialog } from "@/components/desktop/DesktopUpdateDialog";
import { APP_NAME, APP_RELEASES_URL, APP_TAGLINE } from "@/lib/app-meta";
import { checkDesktopUpdate } from "@/lib/desktop-update";
import type { DesktopUpdateStatus } from "@/lib/desktop-update-types";
import { isForgeDesktop } from "@/lib/forge-desktop";
import { useAppVersion } from "@/lib/use-app-version";
import { ListRow } from "@/components/ui";
import { useDeveloperSettings } from "./DeveloperSettingsProvider";

const IDLE_STATUS: DesktopUpdateStatus = {
  phase: "idle",
  currentVersion: "0.0.0",
  version: null,
  releaseNotes: null,
  progress: null,
  error: null,
};

function runtimeLabel() {
  if (typeof window !== "undefined" && window.forgeDesktop?.isDesktop) {
    const platform = window.forgeDesktop.platform;
    if (platform === "darwin") return "macOS desktop app";
    if (platform === "win32") return "Windows desktop app";
    if (platform === "linux") return "Linux desktop app";
    return "Desktop app";
  }
  return "Web app";
}

export function SettingsAbout() {
  const { recordVersionUnlockClick } = useDeveloperSettings();
  const appVersion = useAppVersion();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus>(IDLE_STATUS);

  useEffect(() => {
    if (!updateDialogOpen || !window.forgeDesktop?.onUpdateStatus) return;
    return window.forgeDesktop.onUpdateStatus(setUpdateStatus);
  }, [updateDialogOpen]);

  const handleCheckForUpdates = useCallback(async () => {
    setUpdateDialogOpen(true);
    setUpdateStatus((prev) => ({ ...prev, phase: "checking", error: null }));
    const result = await checkDesktopUpdate();
    setUpdateStatus(result);
  }, []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
          <Info className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-medium">About</h2>
          <p className="text-xs text-text-soft">Version and release information</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col items-center text-center pb-6 mb-2 border-b border-border-soft">
          <Image
            src={iconImage}
            alt={APP_NAME}
            className="w-16 h-16 rounded-xl object-cover shadow-sm"
            width={64}
            height={64}
            priority
          />
          <h3 className="text-xl font-semibold tracking-tight mt-4">{APP_NAME}</h3>
          <button
            type="button"
            onClick={recordVersionUnlockClick}
            className="text-xs text-text-muted mt-1 hover:text-text transition-colors"
          >
            Version {appVersion}
          </button>
        </div>

        <div className="divide-y divide-border-soft">
          <div className="py-1">
            <ListRow
              label={APP_TAGLINE}
              description="Map business processes with Hermes Agent — brief to diagram, iterate in the workshop, ship deliverables."
            />
          </div>
          <div className="py-1">
            <ListRow label="Runtime" description={runtimeLabel()} />
          </div>
          <div className="py-1">
            <ListRow
              label="Release notes"
              description="See what changed in recent builds."
              action={
                <Link
                  href={APP_RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Releases
                </Link>
              }
            />
          </div>
          {isForgeDesktop() ? (
            <div className="py-1">
              <ListRow
                label="Check for updates"
                description="Query GitHub Releases for a newer desktop build."
                action={
                  <button
                    type="button"
                    onClick={() => void handleCheckForUpdates()}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Check now
                  </button>
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <DesktopUpdateDialog
        open={updateDialogOpen}
        status={updateStatus}
        onClose={() => setUpdateDialogOpen(false)}
      />
    </section>
  );
}