import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApproveFromFeatures,
  canSteerFromFeatures,
  parseChatbarCapabilities,
} from "../../lib/chatbar/capabilities.ts";
import { buildChatbarDiagnostics } from "../../lib/chatbar/diagnostics.ts";

describe("parseChatbarCapabilities", () => {
  it("disables steer when features empty (legacy)", () => {
    const caps = parseChatbarCapabilities([]);
    assert.equal(caps.runSteer, false);
    assert.equal(caps.runStop, true);
    // Optimistic: allow answering approval.request if features list is empty
    assert.equal(caps.runApproval, true);
  });

  it("detects steer feature aliases", () => {
    assert.equal(canSteerFromFeatures(["run_steer"]), true);
    assert.equal(canSteerFromFeatures(["runSteer"]), true);
    assert.equal(canSteerFromFeatures(["models"]), false);
  });

  it("detects run_approval feature", () => {
    assert.equal(canApproveFromFeatures(["run_approval"]), true);
    assert.equal(canApproveFromFeatures(["run_approval_response"]), true);
    assert.equal(canApproveFromFeatures(["run_steer", "models"]), false);
  });
});

describe("buildChatbarDiagnostics", () => {
  it("redacts gateway to origin and never includes api keys", () => {
    const blob = buildChatbarDiagnostics({
      hermesBaseUrl: "http://127.0.0.1:8642/v1",
      hermesModel: "hermes-agent",
      connectionError: "Bearer sk-abcdefghijklmnopqrstuvwxyz failed",
      businessId: "biz1234567890",
      route: "/home",
    });
    assert.match(blob, /127\.0\.0\.1:8642/);
    assert.doesNotMatch(blob, /sk-abcdefghijklmnopqrstuvwxyz/);
    assert.match(blob, /\[REDACTED\]|Bearer \[REDACTED/);
    assert.match(blob, /Hermes Forge/);
  });
});
