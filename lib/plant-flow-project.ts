/**
 * Project domain plant (processes + links) → xyflow nodes/edges.
 * Domain remains SoT; canvas is a view (docs/references/LIVING_BUSINESS_MAP.md).
 */

import type { Edge, Node } from "@xyflow/react";
import {
  layoutPlant,
  type PlantLayoutMode,
  type PlantManualPositions,
} from "@/lib/plant-layout";
import type { ProcessLinkDto } from "@/lib/process-links";
import type { IoShapeId } from "@/lib/io-shape";
import { normalizeIoShape } from "@/lib/io-shape";

export type PlantFlowProcess = {
  id: string;
  name: string;
  department: string;
  status?: string | null;
  ioShape?: string | null;
};

export type ForgeProcessNodeData = {
  processId: string;
  name: string;
  department: string;
  status: string;
  ioShape: IoShapeId;
  selected: boolean;
};

export type ProjectPlantToFlowOptions = {
  layoutMode?: PlantLayoutMode;
  positions?: PlantManualPositions;
  selectedProcessId?: string | null;
};

export function projectPlantToFlow(
  processes: PlantFlowProcess[],
  links: ProcessLinkDto[],
  opts: ProjectPlantToFlowOptions = {},
): { nodes: Node<ForgeProcessNodeData>[]; edges: Edge[] } {
  const layoutMode = opts.layoutMode ?? "function";
  const positions = opts.positions ?? {};
  const selectedProcessId = opts.selectedProcessId ?? null;

  const layout = layoutPlant(
    processes.map((p) => ({ id: p.id, department: p.department })),
    {
      mode: layoutMode,
      edges: links.map((l) => ({
        fromId: l.fromProcessId,
        toId: l.toProcessId,
      })),
      positions,
    },
  );

  const byId = new Map(processes.map((p) => [p.id, p]));

  const nodes: Node<ForgeProcessNodeData>[] = layout.tiles.map((tile) => {
    const proc = byId.get(tile.id);
    const name = proc?.name ?? "Process";
    const department = proc?.department ?? tile.department;
    const status = (proc?.status || "draft").toString();
    const ioShape = normalizeIoShape(proc?.ioShape);

    return {
      id: tile.id,
      type: "forgeProcess",
      position: { x: tile.x, y: tile.y },
      data: {
        processId: tile.id,
        name,
        department,
        status,
        ioShape,
        selected: tile.id === selectedProcessId,
      },
      style: {
        width: tile.width,
        height: tile.height,
      },
    };
  });

  const edges: Edge[] = links
    .filter(
      (l) =>
        layout.byId.has(l.fromProcessId) && layout.byId.has(l.toProcessId),
    )
    .map((l) => ({
      id: l.id,
      source: l.fromProcessId,
      target: l.toProcessId,
      type: "smoothstep",
      label: l.label ?? undefined,
      data: { linkId: l.id },
      style: { stroke: "var(--text-muted)" },
      markerEnd: {
        type: "arrowclosed" as const,
        color: "var(--text-muted)",
        width: 16,
        height: 16,
      },
    }));

  return { nodes, edges };
}
