"use client";

import { useMemo } from "react";
import { useRegisterPageContext } from "../useRegisterPageContext";

type Props = {
  processId: string | null;
  processName: string | null;
  processStatus?: string | null;
  department?: string | null;
  functionFilter?: string | null;
  processCount?: number;
  selectedNodeLabel?: string | null;
};

/**
 * Registers Workshop live selection (active process / node) for hermes.forge.context.v1.
 * Process mapping uses pageModule pin + single ChatbarPanel tree
 * (registerPageModule from WorkshopSession).
 */
export function WorkshopPageContext({
  processId,
  processName,
  processStatus,
  department,
  functionFilter,
  processCount = 0,
  selectedNodeLabel,
}: Props) {
  const registration = useMemo(() => {
    const lines = [
      `Workshop co-pilot snapshot (${processCount} process(es) in list)`,
      functionFilter ? `Function filter: ${functionFilter}` : "Function filter: all",
    ];

    if (processId && processName) {
      lines.push(
        `Active process: ${processName} [${processStatus || "unknown"}] id=${processId}`,
      );
      if (department) lines.push(`Department: ${department}`);
      if (selectedNodeLabel) lines.push(`Selected diagram node: ${selectedNodeLabel}`);
    } else {
      lines.push("No process selected");
    }

    return {
      selection: processId && processName
        ? {
            type: "process",
            summary: selectedNodeLabel
              ? `${processName} · node “${selectedNodeLabel}”`
              : `Active process: ${processName}`,
            details: {
              processId,
              processName,
              processStatus: processStatus || null,
              department: department || null,
              selectedNodeLabel: selectedNodeLabel || null,
            },
          }
        : {
            type: "workshop",
            summary: "Workshop — no process selected",
          },
      snapshotLines: lines,
      pinned:
        processId && processName
          ? { type: "process" as const, id: processId, label: processName }
          : undefined,
    };
  }, [
    processId,
    processName,
    processStatus,
    department,
    functionFilter,
    processCount,
    selectedNodeLabel,
  ]);

  useRegisterPageContext(registration);
  return null;
}
