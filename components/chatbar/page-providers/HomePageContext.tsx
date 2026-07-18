"use client";

import { useMemo } from "react";
import { useShell } from "@/components/shell/ShellContext";
import type { ForgeStage } from "@/lib/forge-stage";
import { FORGE_STAGE_LABELS } from "@/lib/forge-stage";
import { useRegisterPageContext } from "../useRegisterPageContext";

/**
 * Registers Home page selection/snapshot extras for hermes.forge.context.v1.
 */
export function HomePageContext({ room = "foundation" }: { room?: ForgeStage }) {
  const { currentBusiness } = useShell();
  const roomLabel = FORGE_STAGE_LABELS[room];

  const registration = useMemo(() => {
    if (!currentBusiness) return null;
    return {
      selection: {
        type: "home",
        summary: `${roomLabel} Home — start a process for ${currentBusiness.name}`,
      },
      snapshotLines: [
        `${roomLabel} Home surface for ${currentBusiness.name}`,
        "Start from a brief in the composer or pick a template pill.",
      ],
    };
  }, [currentBusiness, roomLabel]);

  useRegisterPageContext(registration);
  return null;
}
