import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHermesSessionId,
  buildHermesSessionKey,
} from "../../lib/chatbar/session-headers.ts";

describe("buildHermesSessionKey", () => {
  it("formats forge:user:business:agent", () => {
    assert.equal(
      buildHermesSessionKey({
        userId: "u1",
        businessId: "b1",
        agentProfileKey: "overlord",
      }),
      "forge:u1:b1:overlord",
    );
  });

  it("uses default when profile key missing", () => {
    assert.equal(
      buildHermesSessionKey({
        userId: "u1",
        businessId: "b1",
        agentProfileKey: null,
      }),
      "forge:u1:b1:default",
    );
  });

  it("trims and sanitizes empty agent key", () => {
    assert.equal(
      buildHermesSessionKey({
        userId: "u1",
        businessId: "b1",
        agentProfileKey: "   ",
      }),
      "forge:u1:b1:default",
    );
  });
});

describe("buildHermesSessionId", () => {
  it("formats forge-conv:id", () => {
    assert.equal(buildHermesSessionId("c-123"), "forge-conv:c-123");
  });

  it("returns null for empty conversation id", () => {
    assert.equal(buildHermesSessionId(""), null);
    assert.equal(buildHermesSessionId(null), null);
    assert.equal(buildHermesSessionId(undefined), null);
  });
});
