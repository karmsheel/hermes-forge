/**
 * Shared department-banded plant layout for Foundation / God Mode compact (6.4–6.5).
 */

export const PLANT_TILE = {
  width: 176,
  height: 168,
  gap: 20,
  rowMaxWidth: 1600,
  padding: 64,
  deptHeaderHeight: 36,
  deptGap: 56,
} as const;

export type PlantLayoutItem = {
  id: string;
  department: string;
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
};

export function layoutPlantByDepartment(
  items: PlantLayoutItem[]
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
  };
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
  toward: { x: number; y: number }
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
    Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity
  );
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

export function getDeptLabelY(
  dept: string,
  tiles: PlantTilePosition[]
): number {
  const first = tiles.find((t) => t.department === dept);
  return first
    ? first.y - PLANT_TILE.deptHeaderHeight
    : PLANT_TILE.padding;
}
