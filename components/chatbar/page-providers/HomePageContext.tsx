"use client";

import { useMemo } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { useRegisterPageContext } from "../useRegisterPageContext";

/**
 * Registers Home page selection/snapshot extras for hermes.forge.context.v1.
 */
export function HomePageContext() {
  const { currentBusiness } = useShell();

  const registration = useMemo(() => {
    if (!currentBusiness) return null;
    return {
      selection: {
        type: "home",
        summary: `Home — start a process for ${currentBusiness.name}`,
      },
      snapshotLines: [
        `Home surface for ${currentBusiness.name}`,
        "Start from a brief in the composer or pick a template pill.",
      ],
    };
  }, [currentBusiness]);

  useRegisterPageContext(registration);
  return null;
}
