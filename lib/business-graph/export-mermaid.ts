/**
 * Export structured step graph → Mermaid flowchart string (Phase 8.7).
 *
 * Bridge only — does not make Mermaid source of truth. Prefer Map step graph
 * for authoring; use this for share / paste into docs / legacy tools.
 */

import type { BusinessGraph, GraphNode } from "./types";

export type ExportStepsMermaidOptions = {
  /** flowchart direction (default TD). */
  direction?: "TD" | "TB" | "BT" | "RL" | "LR";
  /** Optional title comment. */
  title?: string | null;
};

/** Characters Mermaid node ids should avoid. */
function mermaidSafeId(raw: string, used: Set<string>): string {
  let base = raw
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^(\d)/, "n$1");
  if (!base) base = "node";
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

/** Escape label text for Mermaid square-bracket nodes. */
function mermaidSafeLabel(label: string): string {
  return label
    .replace(/[[\]]/g, " ")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Build a Mermaid flowchart from step nodes under a process.
 * Returns null when the process is missing; empty string body still yields a
 * valid header-only diagram when there are no steps.
 */
export function exportProcessStepsToMermaid(
  graph: BusinessGraph,
  processId: string,
  options: ExportStepsMermaidOptions = {},
): string | null {
  const process = graph.nodes.find(
    (n) => n.id === processId && n.kind === "process",
  );
  if (!process) return null;

  const steps = graph.nodes
    .filter((n) => n.kind === "step" && n.parentId === processId)
    .slice()
    .sort((a, b) => {
      const ay = a.position?.y ?? 0;
      const by = b.position?.y ?? 0;
      if (ay !== by) return ay - by;
      const ax = a.position?.x ?? 0;
      const bx = b.position?.x ?? 0;
      if (ax !== bx) return ax - bx;
      return a.name.localeCompare(b.name);
    });

  const stepIds = new Set(steps.map((s) => s.id));
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  for (const step of steps) {
    idMap.set(step.id, mermaidSafeId(step.id, usedIds));
  }

  const direction = options.direction ?? "TD";
  const lines: string[] = [];
  const title =
    options.title?.trim() ||
    `Steps: ${process.name} (export from step graph — Mermaid is not SoT)`;
  lines.push(`%% ${title}`);
  lines.push(`flowchart ${direction}`);

  if (steps.length === 0) {
    lines.push(`  empty["No steps yet"]`);
    return lines.join("\n");
  }

  for (const step of steps) {
    const mid = idMap.get(step.id)!;
    lines.push(`  ${mid}["${mermaidSafeLabel(step.name)}"]`);
  }

  const flowEdges = graph.edges.filter(
    (e) =>
      (e.kind === "flows_to" || e.kind === "feeds") &&
      stepIds.has(e.fromId) &&
      stepIds.has(e.toId),
  );

  for (const edge of flowEdges) {
    const from = idMap.get(edge.fromId);
    const to = idMap.get(edge.toId);
    if (!from || !to) continue;
    const label = edge.label?.trim();
    if (label) {
      lines.push(
        `  ${from} -->|"${mermaidSafeLabel(label)}"| ${to}`,
      );
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  // If no edges, chain by sort order so export is still a readable sequence
  if (flowEdges.length === 0 && steps.length > 1) {
    for (let i = 0; i < steps.length - 1; i++) {
      const from = idMap.get(steps[i]!.id)!;
      const to = idMap.get(steps[i + 1]!.id)!;
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return lines.join("\n");
}

/** Steps under a process (helper for UI). */
export function listProcessSteps(
  graph: BusinessGraph,
  processId: string,
): GraphNode[] {
  return graph.nodes.filter(
    (n) => n.kind === "step" && n.parentId === processId,
  );
}
