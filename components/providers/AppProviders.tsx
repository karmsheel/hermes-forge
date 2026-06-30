"use client";

import type { ReactNode } from "react";
import { HermesConnectionProvider } from "@/components/hermes/HermesConnectionProvider";
import { N8nConnectionProvider } from "@/components/n8n/N8nConnectionProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HermesConnectionProvider>
      <N8nConnectionProvider>{children}</N8nConnectionProvider>
    </HermesConnectionProvider>
  );
}