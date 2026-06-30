"use client";

import type { ReactNode } from "react";
import { HermesConnectionProvider } from "@/components/hermes/HermesConnectionProvider";
import { N8nConnectionProvider } from "@/components/n8n/N8nConnectionProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <HermesConnectionProvider>
        <N8nConnectionProvider>{children}</N8nConnectionProvider>
      </HermesConnectionProvider>
    </ThemeProvider>
  );
}