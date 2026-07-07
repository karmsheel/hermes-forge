"use client";

import { useState } from "react";
import { ArrowDownCircle } from "lucide-react";
import { DesktopUpdateDialog } from "./DesktopUpdateDialog";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { useDesktopUpdate } from "@/lib/desktop-update";
import { getPreviewUpdateStatus } from "@/lib/developer-settings";
import { isDesktopUpdateVisible } from "@/lib/desktop-update-types";
import { isForgeDesktop } from "@/lib/forge-desktop";

export function DesktopUpdateIndicator() {
  const { previewUpdateIcon } = useDeveloperSettings();
  const realStatus = useDesktopUpdate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const status = previewUpdateIcon ? getPreviewUpdateStatus() : realStatus;
  const visible =
    previewUpdateIcon || (isForgeDesktop() && isDesktopUpdateVisible(realStatus));

  if (!visible) {
    return null;
  }

  const label =
    status.phase === "downloaded"
      ? "Restart to update"
      : status.phase === "downloading"
        ? "Downloading update"
        : status.phase === "error"
          ? "Update check failed"
          : `Update available${status.version ? ` · v${status.version}` : ""}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="desktop-update-indicator flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border text-accent"
        title={label}
        aria-label={label}
      >
        <ArrowDownCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Update</span>
      </button>

      <DesktopUpdateDialog
        open={dialogOpen}
        status={status}
        isPreview={previewUpdateIcon}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}