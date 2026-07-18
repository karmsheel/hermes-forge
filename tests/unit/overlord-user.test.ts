import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOverlordSet, toOverlordSummary } from "@/lib/overlord/user-overlord";

describe("isOverlordSet", () => {
  it("false when null/empty", () => {
    assert.equal(isOverlordSet({ forgeOverlordProfileKey: null }), false);
    assert.equal(isOverlordSet({ forgeOverlordProfileKey: "" }), false);
  });
  it("true when key present", () => {
    assert.equal(isOverlordSet({ forgeOverlordProfileKey: "my-agent" }), true);
  });
});

describe("toOverlordSummary", () => {
  it("maps fields", () => {
    const s = toOverlordSummary({
      forgeOverlordProfileKey: "a",
      forgeOverlordDisplayName: "A",
      forgeOverlordHermesHome: "/h",
      forgeOverlordSetAt: new Date("2026-07-18T00:00:00.000Z"),
    });
    assert.deepEqual(s, {
      profileKey: "a",
      displayName: "A",
      hermesHome: "/h",
      setAt: "2026-07-18T00:00:00.000Z",
    });
  });
  it("null when unset", () => {
    assert.equal(toOverlordSummary({ forgeOverlordProfileKey: null }), null);
  });
});
