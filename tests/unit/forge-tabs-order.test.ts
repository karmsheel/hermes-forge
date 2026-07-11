import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reorderByIndex,
  selectLruUnloadTargets,
} from "../../lib/forge-tabs/order.ts";

describe("reorderByIndex", () => {
  it("moves an item forward", () => {
    assert.deepEqual(reorderByIndex(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    assert.deepEqual(reorderByIndex(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  });

  it("is a no-op for same index", () => {
    assert.deepEqual(reorderByIndex(["a", "b"], 1, 1), ["a", "b"]);
  });
});

describe("selectLruUnloadTargets", () => {
  it("returns empty when under soft max", () => {
    const targets = selectLruUnloadTargets(
      [
        { id: "a", lastActivated: 3 },
        { id: "b", lastActivated: 1 },
      ],
      "a",
      4,
    );
    assert.deepEqual(targets, []);
  });

  it("unloads least-recent inactive tabs first", () => {
    const targets = selectLruUnloadTargets(
      [
        { id: "active", lastActivated: 10 },
        { id: "old", lastActivated: 1 },
        { id: "mid", lastActivated: 5 },
        { id: "newer", lastActivated: 8 },
        { id: "oldest", lastActivated: 0 },
      ],
      "active",
      3,
    );
    // excess = 2; unload oldest then old
    assert.deepEqual(targets, ["oldest", "old"]);
  });

  it("never unloads the active tab", () => {
    const targets = selectLruUnloadTargets(
      [
        { id: "active", lastActivated: 0 },
        { id: "b", lastActivated: 1 },
        { id: "c", lastActivated: 2 },
      ],
      "active",
      1,
    );
    assert.equal(targets.includes("active"), false);
    assert.equal(targets.length, 2);
  });
});
