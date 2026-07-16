import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPlantLayoutMode,
  layoutPlant,
  layoutPlantByDepartment,
  layoutPlantByFlow,
  layoutPlantManual,
  orthogonalLinkPoints,
  pointsToPathD,
  tileCenter,
  tileEdgePoint,
} from "../../lib/plant-layout.ts";

describe("plant layout modes", () => {
  it("validates mode ids", () => {
    assert.equal(isPlantLayoutMode("function"), true);
    assert.equal(isPlantLayoutMode("flow"), true);
    assert.equal(isPlantLayoutMode("manual"), true);
    assert.equal(isPlantLayoutMode("grid"), false);
  });

  it("layoutPlantByDepartment places tiles and indexes by id", () => {
    const layout = layoutPlantByDepartment([
      { id: "1", department: "Ops" },
      { id: "2", department: "Ops" },
      { id: "3", department: "Sales" },
    ]);
    assert.equal(layout.mode, "function");
    assert.equal(layout.tiles.length, 3);
    assert.ok(layout.byId.get("1"));
    assert.ok(layout.departments.includes("Ops"));
    const c = tileCenter(layout.byId.get("1")!);
    assert.ok(c.x > 0 && c.y > 0);
    const edge = tileEdgePoint(layout.byId.get("1")!, { x: 9999, y: c.y });
    assert.ok(edge.x > c.x);
  });

  it("layoutPlantByFlow layers source → target left to right", () => {
    const layout = layoutPlantByFlow(
      [
        { id: "a", department: "Sales" },
        { id: "b", department: "Ops" },
        { id: "c", department: "Ops" },
      ],
      [
        { fromId: "a", toId: "b" },
        { fromId: "b", toId: "c" },
      ],
    );
    assert.equal(layout.mode, "flow");
    assert.equal(layout.departments.length, 0);
    const ax = layout.byId.get("a")!.x;
    const bx = layout.byId.get("b")!.x;
    const cx = layout.byId.get("c")!.x;
    assert.ok(ax < bx && bx < cx, "layers increase left to right");
  });

  it("layoutPlantByFlow keeps unlinked nodes", () => {
    const layout = layoutPlantByFlow(
      [
        { id: "alone", department: "X" },
        { id: "a", department: "Y" },
        { id: "b", department: "Y" },
      ],
      [{ fromId: "a", toId: "b" }],
    );
    assert.equal(layout.tiles.length, 3);
    assert.ok(layout.byId.get("alone"));
  });

  it("layoutPlantManual prefers saved positions", () => {
    const fallback = layoutPlantByDepartment([
      { id: "1", department: "Ops" },
      { id: "2", department: "Ops" },
    ]);
    const layout = layoutPlantManual(
      [
        { id: "1", department: "Ops" },
        { id: "2", department: "Ops" },
      ],
      { "1": { x: 10, y: 20 } },
      fallback,
    );
    assert.equal(layout.mode, "manual");
    assert.equal(layout.byId.get("1")!.x, 10);
    assert.equal(layout.byId.get("1")!.y, 20);
    // id 2 falls back
    assert.equal(layout.byId.get("2")!.x, fallback.byId.get("2")!.x);
  });

  it("layoutPlant dispatches by mode", () => {
    const items = [
      { id: "a", department: "A" },
      { id: "b", department: "B" },
    ];
    const edges = [{ fromId: "a", toId: "b" }];
    assert.equal(layoutPlant(items, { mode: "function" }).mode, "function");
    assert.equal(layoutPlant(items, { mode: "flow", edges }).mode, "flow");
    assert.equal(
      layoutPlant(items, {
        mode: "manual",
        edges,
        positions: { a: { x: 5, y: 5 } },
      }).mode,
      "manual",
    );
  });

  it("orthogonalLinkPoints uses right-angle segments", () => {
    const from = { id: "a", department: "A", x: 0, y: 0, width: 100, height: 80 };
    const to = { id: "b", department: "B", x: 200, y: 120, width: 100, height: 80 };
    const pts = orthogonalLinkPoints(from, to);
    assert.ok(pts.length >= 2);
    // Every step is axis-aligned
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const sameX = Math.abs(a.x - b.x) < 1e-6;
      const sameY = Math.abs(a.y - b.y) < 1e-6;
      assert.ok(sameX || sameY, `segment ${i} should be orthogonal`);
    }
    const d = pointsToPathD(pts);
    assert.match(d, /^M /);
    assert.match(d, / L /);
  });
});
