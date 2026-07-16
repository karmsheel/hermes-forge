/**
 * Shared plant layout for Foundation / Map plant canvas (6.4–6.6).
 * Modes: by function (department bands) | by flow (link layers) | manual positions.
 */

export const PLANT_TILE = {
  width: 176,
  height: 168,
  gap: 20,
  rowMaxWidth: 1600,
  padding: 64,
  deptHeaderHeight: 36,
  deptGap: 56,
  /** Horizontal gap between flow layers (columns). */
  flowLayerGap: 48,
  /** Vertical gap within a flow layer. */
  flowRowGap: 24,
} as const;

/** Layout algorithm for compact plant tiles. */
export type PlantLayoutMode = "function" | "flow" | "manual";

export const PLANT_LAYOUT_MODES: readonly PlantLayoutMode[] = [
  "function",
  "flow",
  "manual",
] as const;

export const PLANT_LAYOUT_MODE_LABELS: Record<PlantLayoutMode, string> = {
  function: "By function",
  flow: "By flow",
  manual: "Manual",
};

export function isPlantLayoutMode(value: unknown): value is PlantLayoutMode {
  return value === "function" || value === "flow" || value === "manual";
}

export type PlantLayoutItem = {
  id: string;
  department: string;
};

export type PlantLayoutEdge = {
  fromId: string;
  toId: string;
};

export type PlantTilePosition = {
  id: string;
  department: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlantLayoutResult = {
  tiles: PlantTilePosition[];
  canvasWidth: number;
  canvasHeight: number;
  departments: string[];
  /** id → tile for edge geometry */
  byId: Map<string, PlantTilePosition>;
  mode: PlantLayoutMode;
};

export type PlantManualPositions = Record<string, { x: number; y: number }>;

export function layoutPlantByDepartment(
  items: PlantLayoutItem[],
): PlantLayoutResult {
  const groups = new Map<string, PlantLayoutItem[]>();
  for (const item of items) {
    const dept = (item.department || "Uncategorized").trim() || "Uncategorized";
    const list = groups.get(dept) ?? [];
    list.push(item);
    groups.set(dept, list);
  }

  const departments = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const tiles: PlantTilePosition[] = [];
  let y = PLANT_TILE.padding;
  let canvasMaxX = 0;
  const { width: tileW, height: tileH, gap, rowMaxWidth, padding, deptHeaderHeight, deptGap } =
    PLANT_TILE;

  for (const dept of departments) {
    const deptItems = groups.get(dept) ?? [];
    let rowX = padding;
    let rowMaxHeight = 0;
    let rowStartY = y + deptHeaderHeight;

    for (let i = 0; i < deptItems.length; i++) {
      const item = deptItems[i];
      if (i > 0 && rowX + tileW > rowMaxWidth) {
        y = rowStartY + rowMaxHeight + gap;
        rowX = padding;
        rowStartY = y;
        rowMaxHeight = 0;
      }

      tiles.push({
        id: item.id,
        department: dept,
        x: rowX,
        y: rowStartY,
        width: tileW,
        height: tileH,
      });

      rowX += tileW + gap;
      rowMaxHeight = Math.max(rowMaxHeight, tileH);
      canvasMaxX = Math.max(canvasMaxX, rowX);
    }

    y = rowStartY + rowMaxHeight + deptGap;
  }

  const byId = new Map(tiles.map((t) => [t.id, t]));

  return {
    tiles,
    canvasWidth: Math.max(canvasMaxX + padding, 800),
    canvasHeight: Math.max(y + padding, 600),
    departments,
    byId,
    mode: "function",
  };
}

/**
 * Layered left-to-right layout from directed process links (plant streams).
 * Unlinked nodes sit in layer 0; cycles flush into trailing layers.
 */
export function layoutPlantByFlow(
  items: PlantLayoutItem[],
  edges: PlantLayoutEdge[],
): PlantLayoutResult {
  if (items.length === 0) {
    return {
      tiles: [],
      canvasWidth: 800,
      canvasHeight: 600,
      departments: [],
      byId: new Map(),
      mode: "flow",
    };
  }

  const idSet = new Set(items.map((i) => i.id));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const id of idSet) {
    outgoing.set(id, []);
    indegree.set(id, 0);
  }

  for (const e of edges) {
    if (!idSet.has(e.fromId) || !idSet.has(e.toId) || e.fromId === e.toId) continue;
    outgoing.get(e.fromId)!.push(e.toId);
    indegree.set(e.toId, (indegree.get(e.toId) ?? 0) + 1);
  }

  // Longest-path layering (handles DAGs; cycles get a best-effort layer)
  const layerOf = new Map<string, number>();
  const queue: string[] = [];
  for (const id of idSet) {
    if ((indegree.get(id) ?? 0) === 0) {
      queue.push(id);
      layerOf.set(id, 0);
    }
  }

  const remaining = new Map(indegree);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++]!;
    const base = layerOf.get(id) ?? 0;
    for (const to of outgoing.get(id) ?? []) {
      const next = base + 1;
      const prev = layerOf.get(to);
      if (prev === undefined || next > prev) {
        layerOf.set(to, next);
      }
      const d = (remaining.get(to) ?? 1) - 1;
      remaining.set(to, d);
      if (d === 0) queue.push(to);
    }
  }

  // Nodes in cycles / unreachable: place after max layer, stable by name
  let maxLayer = 0;
  for (const l of layerOf.values()) maxLayer = Math.max(maxLayer, l);
  const orphanIds = [...idSet].filter((id) => !layerOf.has(id));
  orphanIds.sort((a, b) => {
    const na = itemById.get(a)?.department ?? "";
    const nb = itemById.get(b)?.department ?? "";
    return na.localeCompare(nb) || a.localeCompare(b);
  });
  for (const id of orphanIds) {
    maxLayer += 1;
    layerOf.set(id, maxLayer);
  }

  const layers = new Map<number, string[]>();
  for (const [id, layer] of layerOf) {
    const list = layers.get(layer) ?? [];
    list.push(id);
    layers.set(layer, list);
  }

  // Stable order within layer: department then id
  for (const [layer, ids] of layers) {
    ids.sort((a, b) => {
      const ia = itemById.get(a)!;
      const ib = itemById.get(b)!;
      return (
        (ia.department || "").localeCompare(ib.department || "") ||
        a.localeCompare(b)
      );
    });
    layers.set(layer, ids);
  }

  const layerIndexes = [...layers.keys()].sort((a, b) => a - b);
  const { width: tileW, height: tileH, padding, flowLayerGap, flowRowGap } = PLANT_TILE;
  const tiles: PlantTilePosition[] = [];
  let canvasMaxY: number = padding;

  for (const layer of layerIndexes) {
    const ids = layers.get(layer) ?? [];
    const colX = padding + layer * (tileW + flowLayerGap);
    let colY = padding;
    for (const id of ids) {
      const item = itemById.get(id)!;
      tiles.push({
        id,
        department: (item.department || "Uncategorized").trim() || "Uncategorized",
        x: colX,
        y: colY,
        width: tileW,
        height: tileH,
      });
      colY += tileH + flowRowGap;
    }
    canvasMaxY = Math.max(canvasMaxY, colY);
  }

  const lastLayer = layerIndexes[layerIndexes.length - 1] ?? 0;
  const canvasWidth = Math.max(
    padding + (lastLayer + 1) * (tileW + flowLayerGap) + padding,
    800,
  );
  const canvasHeight = Math.max(canvasMaxY + padding, 600);
  const byId = new Map(tiles.map((t) => [t.id, t]));

  return {
    tiles,
    canvasWidth,
    canvasHeight,
    departments: [], // flow mode: no department band labels
    byId,
    mode: "flow",
  };
}

/**
 * Manual layout: use saved positions; fall back to `fallback` layout for missing ids.
 */
export function layoutPlantManual(
  items: PlantLayoutItem[],
  positions: PlantManualPositions,
  fallback: PlantLayoutResult,
): PlantLayoutResult {
  const { width: tileW, height: tileH, padding } = PLANT_TILE;
  const tiles: PlantTilePosition[] = [];
  let maxX = 0;
  let maxY = 0;

  for (const item of items) {
    const saved = positions[item.id];
    const fb = fallback.byId.get(item.id);
    const x = saved?.x ?? fb?.x ?? padding;
    const y = saved?.y ?? fb?.y ?? padding;
    const dept = (item.department || "Uncategorized").trim() || "Uncategorized";
    tiles.push({
      id: item.id,
      department: dept,
      x,
      y,
      width: tileW,
      height: tileH,
    });
    maxX = Math.max(maxX, x + tileW);
    maxY = Math.max(maxY, y + tileH);
  }

  const byId = new Map(tiles.map((t) => [t.id, t]));
  return {
    tiles,
    canvasWidth: Math.max(maxX + padding, 800),
    canvasHeight: Math.max(maxY + padding, 600),
    departments: [],
    byId,
    mode: "manual",
  };
}

export type LayoutPlantOptions = {
  mode: PlantLayoutMode;
  edges?: PlantLayoutEdge[];
  positions?: PlantManualPositions;
  /** Fallback auto layout when manual has gaps — default function, or flow if edges present. */
  manualFallback?: "function" | "flow";
};

/** Unified plant layout entry for compact canvases. */
export function layoutPlant(
  items: PlantLayoutItem[],
  options: LayoutPlantOptions,
): PlantLayoutResult {
  const edges = options.edges ?? [];
  if (options.mode === "function") {
    return layoutPlantByDepartment(items);
  }
  if (options.mode === "flow") {
    return layoutPlantByFlow(items, edges);
  }
  const fallbackMode =
    options.manualFallback ?? (edges.length > 0 ? "flow" : "function");
  const fallback =
    fallbackMode === "flow"
      ? layoutPlantByFlow(items, edges)
      : layoutPlantByDepartment(items);
  return layoutPlantManual(items, options.positions ?? {}, fallback);
}

export function tileCenter(tile: PlantTilePosition): { x: number; y: number } {
  return {
    x: tile.x + tile.width / 2,
    y: tile.y + tile.height / 2,
  };
}

/** Point on tile border in the direction of a target center (for edge endpoints). */
export function tileEdgePoint(
  tile: PlantTilePosition,
  toward: { x: number; y: number },
): { x: number; y: number } {
  const cx = tile.x + tile.width / 2;
  const cy = tile.y + tile.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const hw = tile.width / 2;
  const hh = tile.height / 2;
  const scale = Math.min(
    Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity,
  );
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

export function getDeptLabelY(
  dept: string,
  tiles: PlantTilePosition[],
): number {
  const first = tiles.find((t) => t.department === dept);
  return first
    ? first.y - PLANT_TILE.deptHeaderHeight
    : PLANT_TILE.padding;
}
