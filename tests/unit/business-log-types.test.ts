import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUSINESS_EVENT_TYPES,
  eventCategory,
} from "../../lib/business-log-types.ts";

describe("business log event types", () => {
  it("categorizes known event prefixes", () => {
    assert.equal(eventCategory(BUSINESS_EVENT_TYPES.PROCESS_CREATED), "process");
    assert.equal(eventCategory(BUSINESS_EVENT_TYPES.PERSONNEL_HIRED), "personnel");
    assert.equal(eventCategory(BUSINESS_EVENT_TYPES.DECISION_RECORDED), "decision");
    assert.equal(eventCategory(BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE), "chat");
  });

  it("returns all for unknown types", () => {
    assert.equal(eventCategory("something.weird"), "all");
  });

  it("uses personnel.fired for removals (not a dead removed alias)", () => {
    assert.equal(BUSINESS_EVENT_TYPES.PERSONNEL_FIRED, "personnel.fired");
    assert.equal(
      "PERSONNEL_REMOVED" in BUSINESS_EVENT_TYPES,
      false,
      "PERSONNEL_REMOVED should be removed — use PERSONNEL_FIRED",
    );
  });

  it("includes personnel.updated for human identity edits", () => {
    assert.equal(BUSINESS_EVENT_TYPES.PERSONNEL_UPDATED, "personnel.updated");
    assert.equal(eventCategory(BUSINESS_EVENT_TYPES.PERSONNEL_UPDATED), "personnel");
  });
});
