"use client";

import type { ReactNode } from "react";
import { HermesConnectionProvider } from "@/components/hermes/HermesConnectionProvider";
import { N8nConnectionProvider } from "@/components/n8n/N8nConnectionProvider";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { DeveloperSettingsProvider } from "@/components/settings/DeveloperSettingsProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <DeveloperSettingsProvider>
          <HermesConnectionProvider>
            <N8nConnectionProvider>{children}</N8nConnectionProvider>
          </HermesConnectionProvider>
        </DeveloperSettingsProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}