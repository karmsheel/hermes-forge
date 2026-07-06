"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Overlay } from "@/components/ui/Overlay";
import {
  checkDesktopUpdate,
  downloadDesktopUpdate,
  installDesktopUpdate,
} from "@/lib/desktop-update";
import type { DesktopUpdateStatus } from "@/lib/desktop-update-types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DesktopUpdateDialog({
  open,
  status,
  isPreview = false,
  onClose,
}: {
  open: boolean;
  status: DesktopUpdateStatus;
  isPreview?: boolean;
  onClose: () => void;
}) {
  const busy = status.phase === "checking" || status.phase === "downloading";
  const canClose = !busy;

  const title =
    status.phase === "downloaded"
      ? "Ready to install"
      : status.phase === "downloading"
        ? "Downloading update"
        : "Update available";

  const description =
    status.phase === "downloaded"
      ? "The update has been downloaded. Restart Hermes Forge to finish installing."
      : status.phase === "downloading"
        ? "Keep the app open while the update downloads."
        : status.version
          ? `Version ${status.version} is available.`
          : "A newer desktop build is available.";

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeDisabled={!canClose}
    >
      <div className="space-y-4">
        {isPreview ? (
          <p className="text-xs text-text-muted rounded-lg border border-border-soft bg-bg-subtle px-3 py-2">
            Developer preview — actions are disabled. Uncheck &quot;Testing update icon&quot; in
            Settings → Developer to hide this.
          </p>
        ) : null}

        {status.version ? (
          <div className="rounded-lg border border-border-soft bg-bg-subtle px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-muted">Current</span>
              <span className="font-medium text-text-strong">v{status.currentVersion}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-text-muted">New</span>
              <span className="font-medium text-accent">v{status.version}</span>
            </div>
          </div>
        ) : null}

        {status.releaseNotes ? (
          <div className="rounded-lg border border-border-soft px-4 py-3">
            <p className="text-xs font-medium text-text-muted mb-2">What&apos;s new</p>
            <p className="text-sm text-text whitespace-pre-wrap">{status.releaseNotes}</p>
          </div>
        ) : null}

        {status.phase === "downloading" && status.progress ? (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${Math.min(100, Math.max(0, status.progress.percent))}%` }}
              />
            </div>
            <p className="text-xs text-text-muted text-center">
              {Math.round(status.progress.percent)}% ·{" "}
              {formatBytes(status.progress.transferred)} / {formatBytes(status.progress.total)}
            </p>
          </div>
        ) : null}

        {status.error ? (
          <p className="text-sm text-red-400">{status.error}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {!isPreview && (status.phase === "available" || status.phase === "error") ? (
            <Button
              onClick={() => void downloadDesktopUpdate()}
              disabled={busy}
            >
              Download update
            </Button>
          ) : null}

          {!isPreview && status.phase === "downloaded" ? (
            <Button onClick={installDesktopUpdate}>Restart to update</Button>
          ) : null}

          {!isPreview && status.phase === "error" ? (
            <Button
              variant="secondary"
              onClick={() => void checkDesktopUpdate()}
              disabled={busy}
            >
              Check again
            </Button>
          ) : null}

          {status.phase === "downloading" ? (
            <div className="inline-flex items-center gap-2 text-sm text-text-muted px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Downloading…
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}