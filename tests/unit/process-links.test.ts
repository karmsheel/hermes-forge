import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  linkValidationMessage,
  validateProcessLinkEndpoints,
} from "../../lib/process-links.ts";
import {
  layoutPlantByDepartment,
  tileEdgePoint,
  tileCenter,
} from "../../lib/plant-layout.ts";

describe("validateProcessLinkEndpoints", () => {
  it("rejects self-links", () => {
    assert.equal(
      validateProcessLinkEndpoints({
        fromProcessId: "a",
        toProcessId: "a",
        expectedBusinessId: "b1",
      }),
      "same_process"
    );
  });

  it("rejects cross-business", () => {
    assert.equal(
      validateProcessLinkEndpoints({
        fromProcessId: "a",
        toProcessId: "b",
        fromBusinessId: "b1",
        toBusinessId: "b2",
        expectedBusinessId: "b1",
      }),
      "cross_business"
    );
  });

  it("accepts valid directed edge", () => {
    assert.equal(
      validateProcessLinkEndpoints({
        fromProcessId: "a",
        toProcessId: "b",
        fromBusinessId: "b1",
        toBusinessId: "b1",
        expectedBusinessId: "b1",
      }),
      null
    );
  });
});

describe("linkValidationMessage", () => {
  it("returns readable text", () => {
    assert.match(linkValidationMessage("duplicate"), /already exists/i);
  });
});

describe("layoutPlantByDepartment", () => {
  it("places tiles and indexes by id", () => {
    const layout = layoutPlantByDepartment([
      { id: "1", department: "Ops" },
      { id: "2", department: "Ops" },
      { id: "3", department: "Sales" },
    ]);
    assert.equal(layout.tiles.length, 3);
    assert.ok(layout.byId.get("1"));
    assert.ok(layout.departments.includes("Ops"));
    const c = tileCenter(layout.byId.get("1")!);
    assert.ok(c.x > 0 && c.y > 0);
    const edge = tileEdgePoint(layout.byId.get("1")!, { x: 9999, y: c.y });
    assert.ok(edge.x > c.x);
  });
});
