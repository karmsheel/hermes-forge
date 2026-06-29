"use client";

import type { ReactNode } from "react";
import { HermesConnectionProvider } from "@/components/hermes/HermesConnectionProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <HermesConnectionProvider>{children}</HermesConnectionProvider>;
}