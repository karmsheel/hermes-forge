"use client";

import { useState } from "react";
import { ArrowUpCircle } from "lucide-react";
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
        className="nav-rail__item desktop-update-indicator nav-rail__item--accent"
        title={label}
        aria-label={label}
      >
        <ArrowUpCircle className="w-5 h-5" />
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