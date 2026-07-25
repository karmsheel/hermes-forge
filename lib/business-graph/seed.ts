/**
 * Seed a business graph from legacy Prisma rows (functions + processes).
 * Does not parse Mermaid into steps (legacy freeze) — process nodes only.
 */

import type { BusinessGraph, GraphEdge, GraphNode } from "./types";
import { emptyBusinessGraph } from "./types";

export type LegacySeedInput = {
  businessId: string;
  businessName: string;
  functions: Array<{ id: string; name: string; description?: string | null }>;
  processes: Array<{
    id: string;
    name: string;
    department: string;
    description?: string | null;
    status?: string | null;
    businessFunctionId?: string | null;
  }>;
  functionLinks?: Array<{
    id: string;
    fromFunctionId: string;
    toFunctionId: string;
    label?: string | null;
  }>;
  processLinks?: Array<{
    id: string;
    fromProcessId: string;
    toProcessId: string;
    label?: string | null;
  }>;
};

/** Deterministic id without Node crypto (safe for any runtime). */
function stableId(prefix: string, key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${prefix}_${hex}`;
}

/**
 * Build graph from legacy data. Prefer function id for unit nodes;
 * invent capability "General" under each unit that has processes.
 */
export function seedGraphFromLegacy(input: LegacySeedInput): BusinessGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const unitByName = new Map<string, string>();
  const unitById = new Map<string, string>();

  const rootId = `biz_${input.businessId}`;
  nodes.push({
    id: rootId,
    kind: "business",
    name: input.businessName,
    parentId: null,
  });

  for (const fn of input.functions) {
    const name = fn.name.trim() || "Uncategorized";
    nodes.push({
      id: fn.id,
      kind: "unit",
      name,
      parentId: rootId,
      description: fn.description ?? null,
    });
    edges.push({
      id: `contains_${rootId}_${fn.id}`,
      kind: "contains",
      fromId: rootId,
      toId: fn.id,
    });
    unitByName.set(name.toLowerCase(), fn.id);
    unitById.set(fn.id, fn.id);
  }

  // Ensure units for process departments not declared as functions
  for (const p of input.processes) {
    const dept = (p.department || "Uncategorized").trim() || "Uncategorized";
    if (unitByName.has(dept.toLowerCase())) continue;
    const id = stableId("unit", `${input.businessId}:${dept}`);
    nodes.push({
      id,
      kind: "unit",
      name: dept,
      parentId: rootId,
    });
    edges.push({
      id: `contains_${rootId}_${id}`,
      kind: "contains",
      fromId: rootId,
      toId: id,
    });
    unitByName.set(dept.toLowerCase(), id);
  }

  // Capability "General" per unit that has processes
  const capabilityByUnit = new Map<string, string>();
  for (const p of input.processes) {
    const unitId =
      (p.businessFunctionId && unitById.get(p.businessFunctionId)) ||
      unitByName.get(
        ((p.department || "Uncategorized").trim() || "Uncategorized").toLowerCase(),
      );
    if (!unitId) continue;
    if (capabilityByUnit.has(unitId)) continue;
    const capId = stableId("cap", `${unitId}:general`);
    nodes.push({
      id: capId,
      kind: "capability",
      name: "General",
      parentId: unitId,
      props: { synthetic: true },
    });
    edges.push({
      id: `contains_${unitId}_${capId}`,
      kind: "contains",
      fromId: unitId,
      toId: capId,
    });
    capabilityByUnit.set(unitId, capId);
  }

  for (const p of input.processes) {
    const unitId =
      (p.businessFunctionId && unitById.get(p.businessFunctionId)) ||
      unitByName.get(
        ((p.department || "Uncategorized").trim() || "Uncategorized").toLowerCase(),
      );
    const capId = unitId ? capabilityByUnit.get(unitId) : undefined;
    nodes.push({
      id: p.id,
      kind: "process",
      name: p.name,
      parentId: capId ?? unitId ?? rootId,
      description: p.description ?? null,
      props: {
        status: p.status ?? "draft",
        legacyProcessId: p.id,
      },
    });
    if (capId) {
      edges.push({
        id: `contains_${capId}_${p.id}`,
        kind: "contains",
        fromId: capId,
        toId: p.id,
      });
    }
  }

  for (const link of input.functionLinks ?? []) {
    if (!unitById.has(link.fromFunctionId) && !nodes.some((n) => n.id === link.fromFunctionId)) {
      continue;
    }
    edges.push({
      id: link.id,
      kind: "flows_to",
      fromId: link.fromFunctionId,
      toId: link.toFunctionId,
      label: link.label ?? null,
    });
  }

  for (const link of input.processLinks ?? []) {
    edges.push({
      id: link.id,
      kind: "flows_to",
      fromId: link.fromProcessId,
      toId: link.toProcessId,
      label: link.label ?? null,
    });
  }

  // Dedupe edge ids
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of edges) edgeMap.set(e.id, e);

  return {
    ...emptyBusinessGraph(),
    nodes,
    edges: [...edgeMap.values()],
    updatedAt: new Date().toISOString(),
  };
}
