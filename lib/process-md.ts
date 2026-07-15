/**
 * Per-business PROCESS.md contract (backlog 4.2).
 *
 * Generated snapshot of process mapping standards for a business —
 * written to Git materialize and injected into agent prompts.
 */

import {
  getProcessStandard,
  resolveProcessStandard,
  type ProcessStandardId,
} from "@/lib/process-standards";
import { extractSystemsFromProcesses } from "@/lib/systems";
import { getIoShapeMeta, normalizeIoShape } from "@/lib/io-shape";

export interface ProcessMdProcessInput {
  name: string;
  department: string;
  status: string;
  description?: string | null;
  trigger?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  manualSteps?: string | null;
  /** Phase 6.1 — siso | simo | miso | mimo */
  ioShape?: string | null;
}

export interface ProcessMdActorInput {
  name: string;
  role: string;
  kind?: "human" | "agent";
}

export interface ProcessMdInput {
  businessName: string;
  description?: string | null;
  industry?: string | null;
  goals?: string | null;
  constraints?: string | null;
  /** Preferred notation when processes don't specify one */
  defaultNotation?: ProcessStandardId;
  processes: ProcessMdProcessInput[];
  actors?: ProcessMdActorInput[];
  systems?: string[];
  antiPatterns?: string[];
  exportFormat?: string;
}

const DEFAULT_ANTI_PATTERNS = [
  "Do not map multiple independent triggers into a single workflow — split them.",
  "Do not invent systems or actors the user has not confirmed.",
  "Do not output Mermaid in chat replies — the diagram subagent owns diagram syntax.",
  "Avoid overly granular micro-steps; keep labels short and decision-oriented.",
];

const DEFAULT_EXPORT_FORMAT =
  "Markdown SOP, Mermaid source, PNG diagram, PDF diagram, Cursor agent bundle.";

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v?.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Infer systems from free-text process fields (best-effort).
 * Delegates to shared systems extractor (list parse + known product names).
 */
export function inferSystemsFromProcesses(processes: ProcessMdProcessInput[]): string[] {
  return extractSystemsFromProcesses(processes);
}

/**
 * Build the full PROCESS.md markdown document for a business.
 */
export function buildProcessMd(input: ProcessMdInput): string {
  const notationId = input.defaultNotation ?? "auto";
  const notation = getProcessStandard(notationId);

  const actors =
    input.actors && input.actors.length > 0
      ? input.actors
      : [{ name: "Business owner", role: "Owner", kind: "human" as const }];

  const systems =
    input.systems && input.systems.length > 0
      ? uniqueNonEmpty(input.systems)
      : inferSystemsFromProcesses(input.processes);

  const anti = input.antiPatterns?.length ? input.antiPatterns : DEFAULT_ANTI_PATTERNS;
  const exportFmt = input.exportFormat?.trim() || DEFAULT_EXPORT_FORMAT;

  const processLines =
    input.processes.length === 0
      ? ["_No processes mapped yet._"]
      : input.processes.map((p) => {
          const shape = getIoShapeMeta(normalizeIoShape(p.ioShape));
          const bits = [
            `### ${p.name}`,
            `- **Function:** ${p.department}`,
            `- **Status:** ${p.status}`,
            `- **I/O shape:** \`${shape.id}\` (${shape.glyph}) — ${shape.label}`,
          ];
          if (p.trigger?.trim()) bits.push(`- **Trigger:** ${p.trigger.trim()}`);
          if (p.inputs?.trim()) bits.push(`- **Inputs / systems:** ${p.inputs.trim()}`);
          if (p.outputs?.trim()) bits.push(`- **Outputs:** ${p.outputs.trim()}`);
          return bits.join("\n");
        });

  const lines: string[] = [
    `# PROCESS.md — ${input.businessName}`,
    "",
    "> Business process mapping contract for Hermes Forge.",
    "> Generated for agents and Git export. Edit via discovery answers and chat.",
    "",
    "## Overview",
    "",
    input.description?.trim() || "_No business description yet._",
    "",
  ];

  if (input.industry?.trim()) {
    lines.push(`**Industry:** ${input.industry.trim()}`, "");
  }
  if (input.goals?.trim()) {
    lines.push(`**Goals:** ${input.goals.trim()}`, "");
  }
  if (input.constraints?.trim()) {
    lines.push(`**Constraints:** ${input.constraints.trim()}`, "");
  }

  lines.push(
    "## Notation",
    "",
    `- **Default:** ${notation.label} (\`${notation.id}\`)`,
    `- ${notation.shortDescription}`,
    "",
    "## I/O shapes",
    "",
    "Each process has a black-box interface shape (external feeds/products, not internal branches):",
    "- `siso` (→ □ →) — Single in, single out",
    "- `simo` (→ □ ⇉) — Single in, multi out",
    "- `miso` (⇉ □ →) — Multi in, single out",
    "- `mimo` (⇉ □ ⇉) — Multi in, multi out",
    "",
    "## Actors",
    "",
  );

  for (const a of actors) {
    const kind = a.kind === "agent" ? " (Hermes agent)" : "";
    lines.push(`- **${a.name}** — ${a.role}${kind}`);
  }

  lines.push("", "## Systems", "");
  if (systems.length === 0) {
    lines.push("_None confirmed yet — capture tools in the Questions tab or chat._");
  } else {
    for (const s of systems) lines.push(`- ${s}`);
  }

  lines.push("", "## Processes", "", ...processLines, "");

  lines.push("## Anti-patterns", "");
  for (const ap of anti) lines.push(`- ${ap}`);

  lines.push("", "## Export format", "", exportFmt, "");
  lines.push(`_Generated at ${new Date().toISOString()}_`, "");

  return lines.join("\n");
}

/**
 * Compact snippet safe to inject into Hermes system prompts.
 */
export function processMdPromptAddon(processMd: string, maxChars = 1800): string {
  const trimmed = processMd.trim();
  if (!trimmed) return "";
  const body =
    trimmed.length > maxChars
      ? `${trimmed.slice(0, maxChars).trim()}…\n[PROCESS.md truncated]`
      : trimmed;
  return `Business PROCESS.md contract (follow this for actors, systems, and anti-patterns):\n\n${body}`;
}

/**
 * Build PROCESS.md from a Prisma-like business snapshot (materialize / prompts).
 */
export function buildProcessMdFromBusiness(business: {
  name: string;
  description?: string | null;
  industry?: string | null;
  goals?: string | null;
  constraints?: string | null;
  processes?: ProcessMdProcessInput[];
  humanPersonnel?: Array<{ name: string; role: string }>;
  hermesAgentProfiles?: Array<{ displayName: string; description?: string | null; isHired?: boolean }>;
}): string {
  const processes = business.processes ?? [];

  // Prefer notation from first process description tag if present
  let defaultNotation: ProcessStandardId = "auto";
  for (const p of processes) {
    if (p.description) {
      defaultNotation = resolveProcessStandard(p.description);
      if (defaultNotation !== "auto") break;
    }
  }

  const actors: ProcessMdActorInput[] = [
    ...(business.humanPersonnel ?? []).map((h) => ({
      name: h.name,
      role: h.role,
      kind: "human" as const,
    })),
    ...(business.hermesAgentProfiles ?? [])
      .filter((a) => a.isHired !== false)
      .map((a) => ({
        name: a.displayName,
        role: a.description?.trim() || "Hermes agent",
        kind: "agent" as const,
      })),
  ];

  return buildProcessMd({
    businessName: business.name,
    description: business.description,
    industry: business.industry,
    goals: business.goals,
    constraints: business.constraints,
    defaultNotation,
    processes,
    actors: actors.length > 0 ? actors : undefined,
  });
}
