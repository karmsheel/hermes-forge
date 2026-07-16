import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeRoomReadiness,
  isRoomSoftUnlocked,
  preferredRoomForReadiness,
  roomLockHint,
} from "../../lib/forge-room-readiness.ts";

describe("forge-room-readiness", () => {
  it("computes map vs operate readiness", () => {
    const empty = computeRoomReadiness({ processCount: 0, forgedCount: 0 });
    assert.equal(empty.mapReady, false);
    assert.equal(empty.operateReady, false);

    const drafts = computeRoomReadiness({ processCount: 3, forgedCount: 0 });
    assert.equal(drafts.mapReady, true);
    assert.equal(drafts.operateReady, false);

    const forged = computeRoomReadiness({ processCount: 2, forgedCount: 1 });
    assert.equal(forged.mapReady, true);
    assert.equal(forged.operateReady, true);
  });

  it("soft-unlocks rooms by gate", () => {
    const empty = computeRoomReadiness({ processCount: 0, forgedCount: 0 });
    assert.equal(isRoomSoftUnlocked("foundation", empty), true);
    assert.equal(isRoomSoftUnlocked("map", empty), false);
    assert.equal(isRoomSoftUnlocked("monitor", empty), false);
    assert.equal(isRoomSoftUnlocked("automate", empty), false);

    const drafts = computeRoomReadiness({ processCount: 1, forgedCount: 0 });
    assert.equal(isRoomSoftUnlocked("map", drafts), true);
    assert.equal(isRoomSoftUnlocked("monitor", drafts), false);

    const forged = computeRoomReadiness({ processCount: 1, forgedCount: 1 });
    assert.equal(isRoomSoftUnlocked("monitor", forged), true);
    assert.equal(isRoomSoftUnlocked("automate", forged), true);
  });

  it("returns lock hints when locked", () => {
    const empty = computeRoomReadiness({ processCount: 0, forgedCount: 0 });
    assert.equal(roomLockHint("foundation", empty), null);
    assert.ok(roomLockHint("map", empty)?.includes("Foundation"));
    assert.ok(roomLockHint("monitor", empty)?.includes("Forge"));
  });

  it("prefers foundation when map empty", () => {
    assert.equal(
      preferredRoomForReadiness(computeRoomReadiness({ processCount: 0, forgedCount: 0 })),
      "foundation",
    );
    assert.equal(
      preferredRoomForReadiness(computeRoomReadiness({ processCount: 2, forgedCount: 0 })),
      "map",
    );
  });
});
