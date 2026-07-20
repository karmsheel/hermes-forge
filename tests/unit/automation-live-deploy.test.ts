import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAutomationLiveDeployed } from "../../lib/automation-types.ts";

describe("isAutomationLiveDeployed", () => {
  it("is false for missing automation", () => {
    assert.equal(isAutomationLiveDeployed(null), false);
    assert.equal(isAutomationLiveDeployed(undefined), false);
  });

  it("is false for design-only (no externalId)", () => {
    assert.equal(isAutomationLiveDeployed({ externalId: null }), false);
    assert.equal(isAutomationLiveDeployed({ externalId: "" }), false);
    assert.equal(isAutomationLiveDeployed({ externalId: "   " }), false);
    assert.equal(isAutomationLiveDeployed({}), false);
  });

  it("is true when externalId is set (live deploy)", () => {
    assert.equal(isAutomationLiveDeployed({ externalId: "job-123" }), true);
  });
});
