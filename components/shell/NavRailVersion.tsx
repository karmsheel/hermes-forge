"use client";

import { useState } from "react";
import { VersionInfoDialog } from "@/components/desktop/VersionInfoDialog";
import { useAppVersion } from "@/lib/use-app-version";

export function NavRailVersion() {
  const appVersion = useAppVersion();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="nav-rail__version"
        title={`Version ${appVersion}`}
        aria-label={`Version ${appVersion}. View release details.`}
        onClick={() => setDialogOpen(true)}
      >
        v{appVersion}
      </button>

      {dialogOpen ? (
        <VersionInfoDialog
          installedVersion={appVersion}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </>
  );
}