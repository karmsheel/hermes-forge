import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeRoomReadiness,
  isMapReadyFromStats,
  isRoomSoftUnlocked,
  preferredRoomForReadiness,
  roomLockHint,
} from "../../lib/forge-room-readiness.ts";
import {
  countGraphStructure,
  emptyBusinessGraph,
  type BusinessGraph,
} from "../../lib/business-graph/index.ts";

describe("forge-room-readiness", () => {
  it("computes map vs operate readiness from legacy process count", () => {
    const empty = computeRoomReadiness({ processCount: 0, forgedCount: 0 });
    assert.equal(empty.mapReady, false);
    assert.equal(empty.operateReady, false);
    assert.equal(empty.unitCount, 0);
    assert.equal(empty.graphProcessCount, 0);

    const drafts = computeRoomReadiness({ processCount: 3, forgedCount: 0 });
    assert.equal(drafts.mapReady, true);
    assert.equal(drafts.operateReady, false);

    const forged = computeRoomReadiness({ processCount: 2, forgedCount: 1 });
    assert.equal(forged.mapReady, true);
    assert.equal(forged.operateReady, true);
  });

  it("unlocks Map from graph structure without Prisma processes (8.6)", () => {
    const unitsOnly = computeRoomReadiness({
      processCount: 0,
      forgedCount: 0,
      unitCount: 1,
    });
    assert.equal(unitsOnly.mapReady, true);
    assert.equal(unitsOnly.operateReady, false);

    const capsOnly = computeRoomReadiness({
      processCount: 0,
      forgedCount: 0,
      capabilityCount: 2,
    });
    assert.equal(capsOnly.mapReady, true);

    const graphProcessOnly = computeRoomReadiness({
      processCount: 0,
      forgedCount: 0,
      graphProcessCount: 1,
    });
    assert.equal(graphProcessOnly.mapReady, true);

    assert.equal(
      isMapReadyFromStats({ processCount: 0, unitCount: 0, capabilityCount: 0 }),
      false,
    );
  });

  it("soft-unlocks rooms by gate", () => {
    // Loading / unknown readiness — only Foundation + Inventory (no Map flash)
    assert.equal(isRoomSoftUnlocked("foundation", null), true);
    assert.equal(isRoomSoftUnlocked("inventory", null), true);
    assert.equal(isRoomSoftUnlocked("map", null), false);
    assert.equal(isRoomSoftUnlocked("monitor", null), false);

    const empty = computeRoomReadiness({ processCount: 0, forgedCount: 0 });
    assert.equal(isRoomSoftUnlocked("foundation", empty), true);
    assert.equal(isRoomSoftUnlocked("inventory", empty), true);
    assert.equal(isRoomSoftUnlocked("map", empty), false);
    assert.equal(isRoomSoftUnlocked("monitor", empty), false);
    assert.equal(isRoomSoftUnlocked("automate", empty), false);

    const graphDraft = computeRoomReadiness({
      processCount: 0,
      forgedCount: 0,
      unitCount: 1,
      capabilityCount: 1,
    });
    assert.equal(isRoomSoftUnlocked("map", graphDraft), true);
    assert.equal(isRoomSoftUnlocked("monitor", graphDraft), false);

    const drafts = computeRoomReadiness({ processCount: 1, forgedCount: 0 });
    assert.equal(isRoomSoftUnlocked("map", drafts), true);
    assert.equal(isRoomSoftUnlocked("inventory", drafts), true);
    assert.equal(isRoomSoftUnlocked("monitor", drafts), false);

    const forged = computeRoomReadiness({ processCount: 1, forgedCount: 1 });
    assert.equal(isRoomSoftUnlocked("monitor", forged), true);
    assert.equal(isRoomSoftUnlocked("automate", forged), true);
    assert.equal(isRoomSoftUnlocked("inventory", forged), true);
  });

  it("returns lock hints when locked", () => {
    const empty = computeRoomReadiness({ processCount: 0, forgedCount: 0 });
    assert.equal(roomLockHint("foundation", empty), null);
    assert.equal(roomLockHint("inventory", empty), null);
    const mapHint = roomLockHint("map", empty);
    assert.ok(mapHint?.includes("Foundation") || mapHint?.includes("graph"));
    assert.ok(roomLockHint("monitor", empty)?.includes("Forge"));
  });

  it("prefers foundation when map empty", () => {
    assert.equal(
      preferredRoomForReadiness(computeRoomReadiness({ processCount: 0, forgedCount: 0 })),
      "foundation",
    );
    assert.equal(
      preferredRoomForReadiness(
        computeRoomReadiness({ processCount: 0, forgedCount: 0, unitCount: 1 }),
      ),
      "map",
    );
    assert.equal(
      preferredRoomForReadiness(computeRoomReadiness({ processCount: 2, forgedCount: 0 })),
      "map",
    );
  });
});

describe("countGraphStructure", () => {
  it("ignores bare business root for structural map unlock", () => {
    const empty = emptyBusinessGraph();
    assert.equal(countGraphStructure(empty).structuralCount, 0);
    assert.equal(countGraphStructure(null).structuralCount, 0);

    const withRoot: BusinessGraph = {
      version: 1,
      nodes: [{ id: "biz_1", kind: "business", name: "Acme", parentId: null }],
      edges: [],
    };
    assert.equal(countGraphStructure(withRoot).structuralCount, 0);

    const withUnit: BusinessGraph = {
      version: 1,
      nodes: [
        { id: "biz_1", kind: "business", name: "Acme", parentId: null },
        { id: "u1", kind: "unit", name: "Ops", parentId: "biz_1" },
      ],
      edges: [],
    };
    const counts = countGraphStructure(withUnit);
    assert.equal(counts.unitCount, 1);
    assert.equal(counts.structuralCount, 1);
  });
});
