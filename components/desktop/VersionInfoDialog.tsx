"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui";
import { Overlay } from "@/components/ui/Overlay";
import { ReleaseNotesContent } from "@/components/desktop/ReleaseNotesContent";
import { APP_NAME, APP_RELEASES_URL } from "@/lib/app-meta";
import { fetchLatestAppRelease, type AppReleaseInfo } from "@/lib/app-release";
import { isForgeDesktop } from "@/lib/forge-desktop";

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

export function VersionInfoDialog({
  installedVersion,
  onClose,
}: {
  installedVersion: string;
  onClose: () => void;
}) {
  const [release, setRelease] = useState<AppReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchLatestAppRelease()
      .then((next) => {
        if (!cancelled) setRelease(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load release information.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const latestVersion = release?.version ?? installedVersion;
  const isLatest = installedVersion === latestVersion;
  const publishedLabel =
    release?.publishedAt != null
      ? format(new Date(release.publishedAt), "MMM d, yyyy")
      : null;

  return (
    <Overlay
      open
      onClose={onClose}
      title={release?.name ?? `${APP_NAME} v${installedVersion}`}
      description={
        isLatest
          ? `You are running the latest version.`
          : `Installed v${installedVersion} · Latest v${latestVersion}`
      }
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border-soft bg-bg-subtle px-4 py-3 text-sm space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-muted">Installed</span>
            <span className="font-medium text-text-strong">v{installedVersion}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-muted">Latest</span>
            <span className="font-medium text-accent">v{latestVersion}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-muted">Runtime</span>
            <span className="font-medium text-text">{isForgeDesktop() ? runtimeLabel() : "Web app"}</span>
          </div>
          {publishedLabel ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-muted">Released</span>
              <span className="font-medium text-text">{publishedLabel}</span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="inline-flex items-center gap-2 text-sm text-text-muted px-1 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading release notes…
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {release?.body ? (
          <div className="rounded-lg border border-border-soft px-4 py-3">
            <p className="text-xs font-medium text-text-muted mb-2">What&apos;s new</p>
            <ReleaseNotesContent notes={release.body} />
          </div>
        ) : null}

        {!loading && !error && !release?.body ? (
          <p className="text-sm text-text-muted">
            No release notes were published for this version.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Link
            href={release?.url ?? APP_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View on GitHub
          </Link>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Overlay>
  );
}