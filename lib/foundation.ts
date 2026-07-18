/**
 * Foundation room helpers (Phase 6.2).
 * Low-fidelity plant sketch before Workshop deep-mapping.
 */

import { isProcessForged } from "@/lib/process-status";
import { normalizeIoShape, type IoShapeId } from "@/lib/io-shape";

export type FoundationProcessCard = {
  id: string;
  name: string;
  description: string;
  department: string;
  status: string;
  ioShape: IoShapeId;
  diagramMermaid: string | null;
  hasDiagram: boolean;
  updatedAt: string;
  createdAt: string;
};

export type FoundationDocumentSummary = {
  id: string;
  title: string;
  kind: string;
  slug: string;
  pinnedForContext: boolean;
  updatedAt: string;
};

export type FoundationOverview = {
  business: { id: string; name: string; description: string | null } | null;
  processes: FoundationProcessCard[];
  documents: FoundationDocumentSummary[];
  /** Plant edges (6.5) */
  links: import("@/lib/process-links").ProcessLinkDto[];
  stats: {
    processCount: number;
    documentCount: number;
    draftCount: number;
    forgedCount: number;
    withDiagramCount: number;
    linkCount: number;
  };
  /** True when the business is early / thin — prefer Foundation as home. */
  isThin: boolean;
};

export type SeedDraftInput = {
  name: string;
  description?: string | null;
  department?: string | null;
  ioShape?: string | null;
  trigger?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  /** Optional starter Mermaid when seeding from a workflow template (6.7). */
  diagramMermaid?: string | null;
};

/** Early businesses: few processes and none forged yet. */
export function isThinBusiness(input: {
  processCount: number;
  forgedCount?: number;
}): boolean {
  const forged = input.forgedCount ?? 0;
  if (input.processCount === 0) return true;
  if (input.processCount < 3 && forged === 0) return true;
  return false;
}

export function toFoundationProcessCard(p: {
  id: string;
  name: string;
  description: string;
  department: string;
  status: string;
  ioShape?: string | null;
  diagramMermaid?: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
}): FoundationProcessCard {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    department: p.department || "Uncategorized",
    status: p.status,
    ioShape: normalizeIoShape(p.ioShape),
    diagramMermaid: p.diagramMermaid ?? null,
    hasDiagram: Boolean(p.diagramMermaid?.trim()),
    updatedAt:
      typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
    createdAt:
      typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
  };
}

export function countForged(
  processes: Array<{ status: string }>
): number {
  return processes.filter((p) => isProcessForged(p.status)).length;
}

export function normalizeSeedDrafts(
  drafts: SeedDraftInput[]
): Array<Required<Pick<SeedDraftInput, "name">> & SeedDraftInput> {
  const seen = new Set<string>();
  const out: Array<Required<Pick<SeedDraftInput, "name">> & SeedDraftInput> = [];
  for (const d of drafts) {
    const name = d.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const diagram = d.diagramMermaid?.trim() || null;
    out.push({
      name: name.slice(0, 200),
      description: d.description?.trim() || "",
      department: d.department?.trim() || null,
      ioShape: d.ioShape ?? null,
      trigger: d.trigger?.trim() || null,
      inputs: d.inputs?.trim() || null,
      outputs: d.outputs?.trim() || null,
      diagramMermaid: diagram ? diagram.slice(0, 20000) : null,
    });
  }
  return out;
}

/** Studio / chatbar guidance when the user is on Foundation. */
export function foundationStudioPromptAddon(): string {
  return [
    "You are Overlord, the Foundation room co-pilot in Hermes Forge.",
    "Foundation is a plant sketch of the business at low fidelity — not full Mermaid diagrams yet.",
    "Help the user inventory channels, offers, ops units, and handoffs as draft process blocks.",
    "When they describe parts of the business (e.g. Twitter, YouTube, fulfillment), propose short draft process names with suggested I/O shapes (siso/simo/miso/mimo).",
    "Plant tools — when you want the app to write data, end your reply with one or more fenced JSON blocks. The server auto-applies them after your message:",
    "1) Seed/upsert draft process blocks:",
    "```forge-drafts",
    '[{"name":"Example","description":"...","department":"Operations","ioShape":"siso","inputs":"...","outputs":"..."}]',
    "```",
    "2) Write durable knowledge docs (match slug like basics/market or create freeform):",
    "```forge-docs",
    '[{"slug":"basics","bodyMarkdown":"## Purpose\\n...","mode":"replace"}]',
    "```",
    "3) Create plant handoff edges (process names must exist — seed drafts first in the same reply if needed):",
    "```forge-links",
    '[{"from":"Lead gen","to":"Fulfillment","label":"orders"}]',
    "```",
    "Only include processes and facts the user described. Omit fences when you are only answering without writing plant data.",
    "After auto-apply, briefly confirm what was written. Prefer 3–8 draft processes over dozens.",
    "Do not invent systems the user has not mentioned.",
    "Users can still Add draft manually, draw links in Link mode, or open Workshop (Map room tool) to refine.",
    "After drafts exist, encourage opening the Map room plant; after forging a process, Monitor and Automate soft-unlock.",
  ].join("\n");
}
