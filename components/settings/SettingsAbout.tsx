"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import iconImage from "@/assets/icon.jpg";
import { APP_NAME, APP_RELEASES_URL, APP_TAGLINE, APP_VERSION } from "@/lib/app-meta";
import { ListRow } from "@/components/ui";
import { useDeveloperSettings } from "./DeveloperSettingsProvider";

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
            Version {APP_VERSION}
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
        </div>
      </div>
    </section>
  );
}