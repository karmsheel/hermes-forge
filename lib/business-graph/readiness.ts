/**
 * Graph maturity counters for room soft-unlock (Phase 8.6).
 * Client-safe pure helpers — no Prisma.
 */

import type { BusinessGraph } from "./types";

export type GraphStructureCounts = {
  unitCount: number;
  capabilityCount: number;
  /** Process-kind nodes in graphJson (not Prisma Process rows). */
  graphProcessCount: number;
  stepCount: number;
  /**
   * Structural map content: units, capabilities, or processes.
   * Root `business` node alone does not count.
   */
  structuralCount: number;
};

/**
 * Count graph nodes that unlock Map / indicate a modeled business.
 * Rule (8.6): Map soft-unlocks when ≥1 unit | capability | process exists in graph.
 */
export function countGraphStructure(
  graph: BusinessGraph | null | undefined,
): GraphStructureCounts {
  let unitCount = 0;
  let capabilityCount = 0;
  let graphProcessCount = 0;
  let stepCount = 0;
  for (const node of graph?.nodes ?? []) {
    switch (node.kind) {
      case "unit":
        unitCount += 1;
        break;
      case "capability":
        capabilityCount += 1;
        break;
      case "process":
        graphProcessCount += 1;
        break;
      case "step":
        stepCount += 1;
        break;
      default:
        break;
    }
  }
  return {
    unitCount,
    capabilityCount,
    graphProcessCount,
    stepCount,
    structuralCount: unitCount + capabilityCount + graphProcessCount,
  };
}

/** True when the graph has enough structure to open Map. */
export function graphHasMapStructure(
  graph: BusinessGraph | null | undefined,
): boolean {
  return countGraphStructure(graph).structuralCount >= 1;
}
