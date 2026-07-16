"use client";

import { useMemo } from "react";
import type { ProcessLinkDto } from "@/lib/process-links";
import type { ProcessSummary } from "@/lib/types";
import { useRegisterPageContext } from "../useRegisterPageContext";

type Props = {
  /** Selected plant block, or null when nothing selected. */
  process: ProcessSummary | null;
  links?: ProcessLinkDto[];
  processCount?: number;
};

/**
 * Registers Map plant selection for hermes.forge.context.v1 so the global
 * chatbar shows a selection pill and injects process context into the agent prompt.
 */
export function PlantPageContext({
  process,
  links = [],
  processCount = 0,
}: Props) {
  const registration = useMemo(() => {
    if (!process) {
      return {
        selection: {
          type: "plant",
          summary: "Map plant — no process block selected",
        },
        snapshotLines: [
          `Map plant canvas (${processCount} process block(s))`,
          "No process block selected. User can click a block to select it and ask about that process.",
        ],
      };
    }

    const outgoing = links.filter((l) => l.fromProcessId === process.id);
    const incoming = links.filter((l) => l.toProcessId === process.id);
    const hasDiagram = Boolean(process.diagramMermaid?.trim());

    const lines = [
      `Map plant · selected process block`,
      `Process: ${process.name}`,
      `id: ${process.id}`,
      `status: ${process.status}`,
      `department/function: ${process.department || "Uncategorized"}`,
      `I/O shape: ${process.ioShape || "siso"}`,
      process.description?.trim()
        ? `description: ${process.description.trim().slice(0, 500)}`
        : "description: (none)",
      `has diagram: ${hasDiagram ? "yes" : "no"}`,
      `chat messages on process: ${process._count?.messages ?? 0}`,
    ];

    if (incoming.length > 0) {
      lines.push(
        `incoming plant links (${incoming.length}): ${incoming
          .map((l) => l.fromName || l.fromProcessId)
          .join(", ")}`,
      );
    } else {
      lines.push("incoming plant links: none");
    }
    if (outgoing.length > 0) {
      lines.push(
        `outgoing plant links (${outgoing.length}): ${outgoing
          .map((l) => l.toName || l.toProcessId)
          .join(", ")}`,
      );
    } else {
      lines.push("outgoing plant links: none");
    }

    if (hasDiagram && process.diagramMermaid) {
      const mermaid = process.diagramMermaid.trim();
      const clipped =
        mermaid.length > 1200 ? `${mermaid.slice(0, 1199).trimEnd()}…` : mermaid;
      lines.push("diagram (Mermaid, may be truncated):");
      lines.push(clipped);
    }

    lines.push(
      "The user selected this block on the Map plant. Prefer answering about this process; suggest Workshop only when they need deep diagram editing.",
    );

    return {
      selection: {
        type: "process",
        summary: process.name,
        details: {
          processId: process.id,
          processName: process.name,
          processStatus: process.status,
          department: process.department || null,
          ioShape: process.ioShape || null,
          hasDiagram,
          source: "map-plant",
          incomingLinkCount: incoming.length,
          outgoingLinkCount: outgoing.length,
        },
      },
      snapshotLines: lines,
      pinned: {
        type: "process" as const,
        id: process.id,
        label: process.name,
      },
    };
  }, [process, links, processCount]);

  useRegisterPageContext(registration);
  return null;
}
