/**
 * External plant feeds / products framing (Phase 6.6 trail).
 *
 * Derives business-level outside I/O from process graph topology:
 * - **Inputs** (feeds): free-text `inputs` on processes with no inbound plant links
 * - **Outcomes** (products): free-text `outputs` on processes with no outbound plant links
 *
 * User-facing copy stays plain ("Inputs" / "Outcomes") — not chem-eng jargon.
 */

import { listBoundaryItems } from "@/lib/io-shape";
import type { PlantTilePosition } from "@/lib/plant-layout";

export const PLANT_BOUNDARY_CHIP = {
  width: 128,
  height: 34,
  gap: 8,
  /** Horizontal gap between chip and process tile. */
  railGap: 32,
  pad: 24,
} as const;

export type PlantBoundaryKind = "feed" | "product";

export type PlantBoundaryItem = {
  id: string;
  kind: PlantBoundaryKind;
  label: string;
  processId: string;
  processName: string;
};

export type PlantBoundaryProcess = {
  id: string;
  name: string;
  inputs?: string | null;
  outputs?: string | null;
};

export type PlantBoundaryLink = {
  fromId: string;
  toId: string;
};

export type DerivePlantBoundaryResult = {
  feeds: PlantBoundaryItem[];
  products: PlantBoundaryItem[];
  entryProcessIds: string[];
  exitProcessIds: string[];
};

/**
 * Classify plant edge processes and collect outside I/O labels.
 */
export function derivePlantBoundary(
  processes: PlantBoundaryProcess[],
  links: PlantBoundaryLink[],
): DerivePlantBoundaryResult {
  const ids = new Set(processes.map((p) => p.id));
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const id of ids) {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }
  for (const link of links) {
    if (!ids.has(link.fromId) || !ids.has(link.toId)) continue;
    if (link.fromId === link.toId) continue;
    outDegree.set(link.fromId, (outDegree.get(link.fromId) ?? 0) + 1);
    inDegree.set(link.toId, (inDegree.get(link.toId) ?? 0) + 1);
  }

  const entryProcessIds: string[] = [];
  const exitProcessIds: string[] = [];
  for (const p of processes) {
    if ((inDegree.get(p.id) ?? 0) === 0) entryProcessIds.push(p.id);
    if ((outDegree.get(p.id) ?? 0) === 0) exitProcessIds.push(p.id);
  }

  const byId = new Map(processes.map((p) => [p.id, p]));
  const feeds: PlantBoundaryItem[] = [];
  const products: PlantBoundaryItem[] = [];

  for (const processId of entryProcessIds) {
    const proc = byId.get(processId);
    if (!proc) continue;
    const labels = listBoundaryItems(proc.inputs);
    labels.forEach((label, i) => {
      feeds.push({
        id: `feed:${processId}:${i}`,
        kind: "feed",
        label,
        processId,
        processName: proc.name,
      });
    });
  }

  for (const processId of exitProcessIds) {
    const proc = byId.get(processId);
    if (!proc) continue;
    const labels = listBoundaryItems(proc.outputs);
    labels.forEach((label, i) => {
      products.push({
        id: `product:${processId}:${i}`,
        kind: "product",
        label,
        processId,
        processName: proc.name,
      });
    });
  }

  return { feeds, products, entryProcessIds, exitProcessIds };
}

export type PlacedBoundaryChip = PlantBoundaryItem & {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Attachment point on the process tile (for dashed connector). */
  attachX: number;
  attachY: number;
};

export type PlantBoundaryLayout = {
  feeds: PlacedBoundaryChip[];
  products: PlacedBoundaryChip[];
  /** Offset applied so chips at negative coords fit; add to tile left/top. */
  tileOffset: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  hasItems: boolean;
};

function placeChipStack(
  items: PlantBoundaryItem[],
  tile: PlantTilePosition,
  side: "left" | "right",
): PlacedBoundaryChip[] {
  const { width, height, gap, railGap } = PLANT_BOUNDARY_CHIP;
  if (items.length === 0) return [];

  const totalH = items.length * height + (items.length - 1) * gap;
  let y = tile.y + (tile.height - totalH) / 2;
  const x =
    side === "left"
      ? tile.x - railGap - width
      : tile.x + tile.width + railGap;
  const attachX = side === "left" ? tile.x : tile.x + tile.width;
  const attachY = tile.y + tile.height / 2;

  return items.map((item) => {
    const placed: PlacedBoundaryChip = {
      ...item,
      x,
      y,
      width,
      height,
      attachX,
      attachY,
    };
    y += height + gap;
    return placed;
  });
}

/**
 * Place input/outcome chips beside process tiles and expand canvas bounds.
 */
export function layoutPlantBoundaryFraming(opts: {
  tiles: PlantTilePosition[];
  baseCanvasWidth: number;
  baseCanvasHeight: number;
  processes: PlantBoundaryProcess[];
  links: PlantBoundaryLink[];
}): PlantBoundaryLayout {
  const derived = derivePlantBoundary(opts.processes, opts.links);
  const byId = new Map(opts.tiles.map((t) => [t.id, t]));

  const feedsByProc = new Map<string, PlantBoundaryItem[]>();
  for (const f of derived.feeds) {
    const list = feedsByProc.get(f.processId) ?? [];
    list.push(f);
    feedsByProc.set(f.processId, list);
  }
  const productsByProc = new Map<string, PlantBoundaryItem[]>();
  for (const p of derived.products) {
    const list = productsByProc.get(p.processId) ?? [];
    list.push(p);
    productsByProc.set(p.processId, list);
  }

  let feeds: PlacedBoundaryChip[] = [];
  let products: PlacedBoundaryChip[] = [];

  for (const [processId, items] of feedsByProc) {
    const tile = byId.get(processId);
    if (!tile) continue;
    feeds = feeds.concat(placeChipStack(items, tile, "left"));
  }
  for (const [processId, items] of productsByProc) {
    const tile = byId.get(processId);
    if (!tile) continue;
    products = products.concat(placeChipStack(items, tile, "right"));
  }

  const hasItems = feeds.length > 0 || products.length > 0;
  if (!hasItems) {
    return {
      feeds: [],
      products: [],
      tileOffset: { x: 0, y: 0 },
      canvasWidth: opts.baseCanvasWidth,
      canvasHeight: opts.baseCanvasHeight,
      hasItems: false,
    };
  }

  const pad = PLANT_BOUNDARY_CHIP.pad;
  let minX = 0;
  let minY = 0;
  let maxX = opts.baseCanvasWidth;
  let maxY = opts.baseCanvasHeight;

  for (const chip of [...feeds, ...products]) {
    minX = Math.min(minX, chip.x);
    minY = Math.min(minY, chip.y);
    maxX = Math.max(maxX, chip.x + chip.width);
    maxY = Math.max(maxY, chip.y + chip.height);
  }

  const tileOffsetX = minX < pad ? pad - minX : 0;
  const tileOffsetY = minY < pad ? pad - minY : 0;

  const shift = (chips: PlacedBoundaryChip[]) =>
    chips.map((c) => ({
      ...c,
      x: c.x + tileOffsetX,
      y: c.y + tileOffsetY,
      attachX: c.attachX + tileOffsetX,
      attachY: c.attachY + tileOffsetY,
    }));

  feeds = shift(feeds);
  products = shift(products);

  return {
    feeds,
    products,
    tileOffset: { x: tileOffsetX, y: tileOffsetY },
    canvasWidth: Math.max(opts.baseCanvasWidth + tileOffsetX, maxX + tileOffsetX + pad),
    canvasHeight: Math.max(opts.baseCanvasHeight + tileOffsetY, maxY + tileOffsetY + pad),
    hasItems: true,
  };
}
