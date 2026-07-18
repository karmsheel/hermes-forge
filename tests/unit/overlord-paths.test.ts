import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOverlordExemptPath } from "@/lib/overlord/paths";

describe("isOverlordExemptPath", () => {
  it("allows setup, settings, profile", () => {
    assert.equal(isOverlordExemptPath("/setup/overlord"), true);
    assert.equal(isOverlordExemptPath("/settings"), true);
    assert.equal(isOverlordExemptPath("/settings/appearance"), true);
    assert.equal(isOverlordExemptPath("/profile"), true);
  });

  it("does not allow business-manager or rooms", () => {
    assert.equal(isOverlordExemptPath("/business-manager"), false);
    assert.equal(isOverlordExemptPath("/foundation"), false);
    assert.equal(isOverlordExemptPath("/home"), false);
    assert.equal(isOverlordExemptPath("/personnel/hire"), false);
  });
});
