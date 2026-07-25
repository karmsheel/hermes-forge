/**
 * Load / save business graph from Prisma (local-first SQLite).
 */

import { prisma } from "@/lib/prisma";
import { parseBusinessGraph, serializeBusinessGraph } from "./parse";
import { applyGraphPatch } from "./patch";
import { seedGraphFromLegacy } from "./seed";
import type { BusinessGraph, GraphPatch } from "./types";
import { emptyBusinessGraph } from "./types";

export async function loadBusinessGraph(
  businessId: string,
): Promise<BusinessGraph> {
  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { graphJson: true },
  });
  if (!row) return emptyBusinessGraph();
  return parseBusinessGraph(row.graphJson);
}

export async function saveBusinessGraph(
  businessId: string,
  graph: BusinessGraph,
): Promise<BusinessGraph> {
  const json = serializeBusinessGraph(graph);
  await prisma.business.update({
    where: { id: businessId },
    data: { graphJson: json },
  });
  return parseBusinessGraph(json);
}

export async function applyAndSaveGraphPatch(
  businessId: string,
  patch: GraphPatch,
): Promise<{ graph: BusinessGraph; applied: number; errors: string[] }> {
  const current = await loadBusinessGraph(businessId);
  const result = applyGraphPatch(current, patch);
  await saveBusinessGraph(businessId, result.graph);
  return result;
}

/**
 * If graph is empty, seed from functions/processes and persist.
 * Returns whether a seed was written.
 */
export async function ensureBusinessGraphSeeded(
  businessId: string,
): Promise<{ graph: BusinessGraph; seeded: boolean }> {
  const existing = await loadBusinessGraph(businessId);
  if (existing.nodes.length > 0) {
    return { graph: existing, seeded: false };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      functions: { select: { id: true, name: true, description: true } },
      processes: {
        select: {
          id: true,
          name: true,
          department: true,
          description: true,
          status: true,
          businessFunctionId: true,
        },
      },
      functionLinks: {
        select: {
          id: true,
          fromFunctionId: true,
          toFunctionId: true,
          label: true,
        },
      },
      processLinks: {
        select: {
          id: true,
          fromProcessId: true,
          toProcessId: true,
          label: true,
        },
      },
    },
  });

  if (!business) {
    return { graph: emptyBusinessGraph(), seeded: false };
  }

  const graph = seedGraphFromLegacy({
    businessId: business.id,
    businessName: business.name,
    functions: business.functions,
    processes: business.processes,
    functionLinks: business.functionLinks,
    processLinks: business.processLinks,
  });

  if (graph.nodes.length <= 1 && business.processes.length === 0) {
    // Only root business node — still save so Foundation has a root
    await saveBusinessGraph(businessId, graph);
    return { graph, seeded: true };
  }

  await saveBusinessGraph(businessId, graph);
  return { graph, seeded: true };
}

/** Force re-seed from legacy tables (overwrites graphJson). */
export async function reseedBusinessGraph(
  businessId: string,
): Promise<BusinessGraph> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      functions: { select: { id: true, name: true, description: true } },
      processes: {
        select: {
          id: true,
          name: true,
          department: true,
          description: true,
          status: true,
          businessFunctionId: true,
        },
      },
      functionLinks: {
        select: {
          id: true,
          fromFunctionId: true,
          toFunctionId: true,
          label: true,
        },
      },
      processLinks: {
        select: {
          id: true,
          fromProcessId: true,
          toProcessId: true,
          label: true,
        },
      },
    },
  });
  if (!business) return emptyBusinessGraph();
  const graph = seedGraphFromLegacy({
    businessId: business.id,
    businessName: business.name,
    functions: business.functions,
    processes: business.processes,
    functionLinks: business.functionLinks,
    processLinks: business.processLinks,
  });
  return saveBusinessGraph(businessId, graph);
}
