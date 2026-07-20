"use client";

import { useEffect, type ReactNode } from "react";
import { DesktopOutsideShellChrome } from "@/components/desktop/DesktopOutsideShellChrome";
import { HermesConnectionProvider } from "@/components/hermes/HermesConnectionProvider";
import { N8nConnectionProvider } from "@/components/n8n/N8nConnectionProvider";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { DeveloperSettingsProvider } from "@/components/settings/DeveloperSettingsProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ForgeToaster } from "@/components/theme/ForgeToaster";
import { isForgeDesktop } from "@/lib/forge-desktop";

function DesktopDocumentClass() {
  useEffect(() => {
    if (!isForgeDesktop()) return;
    document.documentElement.classList.add("is-forge-desktop");
    return () => document.documentElement.classList.remove("is-forge-desktop");
  }, []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <DeveloperSettingsProvider>
          <HermesConnectionProvider>
            <N8nConnectionProvider>
              <DesktopDocumentClass />
              {/* Frameless desktop: drag + window controls on auth/startup (no AppShell) */}
              <DesktopOutsideShellChrome />
              {children}
            </N8nConnectionProvider>
          </HermesConnectionProvider>
        </DeveloperSettingsProvider>
        <ForgeToaster />
      </ThemeProvider>
    </LocaleProvider>
  );
}