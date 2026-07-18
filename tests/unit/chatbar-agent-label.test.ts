import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatChatbarAgentLabel,
  isChatbarHiddenPath,
  isChatbarOverlordOnlyPath,
} from "@/lib/chatbar/agent-label";

describe("formatChatbarAgentLabel", () => {
  it("prefixes Overlord when profileKey matches", () => {
    assert.equal(
      formatChatbarAgentLabel(
        { displayName: "Forge Boss", profileKey: "forge-boss" },
        "forge-boss",
      ),
      "Overlord (Forge Boss)",
    );
  });

  it("returns plain name for other agents", () => {
    assert.equal(
      formatChatbarAgentLabel(
        { displayName: "Ops", profileKey: "ops" },
        "forge-boss",
      ),
      "Ops",
    );
  });

  it("returns plain name when overlord key missing", () => {
    assert.equal(
      formatChatbarAgentLabel({ displayName: "Ops", profileKey: "ops" }, null),
      "Ops",
    );
  });
});

describe("isChatbarOverlordOnlyPath", () => {
  it("true for business manager", () => {
    assert.equal(isChatbarOverlordOnlyPath("/business-manager"), true);
    assert.equal(isChatbarOverlordOnlyPath("/business-manager/"), true);
  });

  it("false inside a business room", () => {
    assert.equal(isChatbarOverlordOnlyPath("/foundation"), false);
    assert.equal(isChatbarOverlordOnlyPath("/home"), false);
    assert.equal(isChatbarOverlordOnlyPath("/personnel"), false);
  });
});

describe("isChatbarHiddenPath", () => {
  it("true for setup routes", () => {
    assert.equal(isChatbarHiddenPath("/setup/overlord"), true);
    assert.equal(isChatbarHiddenPath("/setup"), true);
  });

  it("false elsewhere", () => {
    assert.equal(isChatbarHiddenPath("/business-manager"), false);
    assert.equal(isChatbarHiddenPath("/foundation"), false);
  });
});
