import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildForgeContext,
  buildPageIntroCopy,
  clampSnapshotText,
  FORGE_CONTEXT_PROTOCOL,
  serializeForgeContextForPrompt,
} from "../../lib/chatbar/context-protocol.ts";
import { CHATBAR_CONTEXT_MODES } from "../../lib/chatbar/context-scope.ts";
import { redactSecrets } from "../../lib/chatbar/redaction.ts";
import { pageBlurbForPath } from "../../lib/chatbar/page-registry.ts";
import { buildStudioPageContextMessage } from "../../lib/chatbar/studio-prompt.ts";

describe("redactSecrets", () => {
  it("redacts sk- style keys", () => {
    const r = redactSecrets("key sk-abcdefghijklmnopqrstuvwxyz1234 end");
    assert.ok(r.redactionCount >= 1);
    assert.doesNotMatch(r.text, /sk-abcdefgh/);
    assert.match(r.text, /REDACTED/);
  });
});

describe("buildForgeContext", () => {
  it("includes snapshot in follow-page mode", () => {
    const { payload, receipt } = buildForgeContext({
      mode: CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
      route: "/home",
      business: { id: "b1", name: "Acme" },
      shellSnapshotText: "Process count: 3\n- Onboarding",
      registration: {
        selection: { type: "home", summary: "3 recent processes" },
      },
    });

    assert.equal(payload.protocol, FORGE_CONTEXT_PROTOCOL);
    assert.equal(payload.contextScope.mode, "follow-page");
    assert.ok(payload.snapshot?.text.includes("Process count"));
    assert.equal(payload.selection?.summary, "3 recent processes");
    assert.ok(receipt.snapshotChars > 0);
    assert.equal(receipt.pageTitle, "Home");
  });

  it("strips snapshot in chat-only mode", () => {
    const { payload, receipt } = buildForgeContext({
      mode: CHATBAR_CONTEXT_MODES.CHAT_ONLY,
      route: "/functions",
      business: { id: "b1", name: "Acme" },
      shellSnapshotText: "secret stuff Process count: 9",
      registration: {
        selection: { type: "functions", summary: "should not appear" },
        pinned: { type: "process", id: "p1", label: "X" },
      },
    });

    assert.equal(payload.contextScope.mode, "chat-only");
    assert.equal(payload.snapshot, undefined);
    assert.equal(payload.selection, undefined);
    assert.equal(payload.contextScope.pinned, undefined);
    assert.equal(receipt.snapshotChars, 0);
  });

  it("redacts secrets in snapshot", () => {
    const { payload, receipt } = buildForgeContext({
      mode: CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
      route: "/settings",
      business: { id: "b1", name: "Acme" },
      shellSnapshotText: "token sk-abcdefghijklmnopqrstuvwxyz9999 here",
    });
    assert.ok(payload.snapshot?.text.includes("REDACTED"));
    assert.ok(receipt.redactionCount >= 1);
  });
});

describe("serializeForgeContextForPrompt", () => {
  it("wraps untrusted markers", () => {
    const { payload } = buildForgeContext({
      mode: CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
      route: "/personnel",
      business: { id: "b1", name: "Acme" },
      shellSnapshotText: "Humans: 2",
    });
    const block = serializeForgeContextForPrompt(payload);
    assert.match(block, /UNTRUSTED_FORGE_CONTEXT_START/);
    assert.match(block, /hermes\.forge\.context\.v1/);
    assert.match(block, /Humans: 2/);
    assert.match(block, /UNTRUSTED_FORGE_CONTEXT_END/);
  });
});

describe("buildStudioPageContextMessage", () => {
  it("accepts payload form", () => {
    const { payload } = buildForgeContext({
      mode: CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
      route: "/log",
      business: { id: "b1", name: "Acme" },
      shellSnapshotText: "events: 1",
    });
    const msg = buildStudioPageContextMessage({ payload });
    assert.match(msg, /Business log/);
  });
});

describe("clampSnapshotText", () => {
  it("truncates long snapshots", () => {
    const r = clampSnapshotText("x".repeat(5000), 100);
    assert.ok(r.truncated);
    assert.ok(r.text.length <= 100);
  });
});

describe("page intros", () => {
  it("builds intro with hints and separates agent view", () => {
    const page = pageBlurbForPath("/personnel");
    const copy = buildPageIntroCopy({
      businessName: "Acme",
      page,
      snapshotText: "Humans: 2\nRoles: 1",
    });
    assert.match(copy.body, /Personnel/);
    assert.match(copy.body, /Acme/);
    // Snapshot stays out of the always-visible body (UI collapses it).
    assert.ok(!copy.body.includes("Humans: 2"));
    assert.equal(copy.agentView, "Humans: 2\nRoles: 1");
  });

  it("omits agent view when no snapshot", () => {
    const page = pageBlurbForPath("/home");
    const copy = buildPageIntroCopy({
      businessName: "Acme",
      page,
    });
    assert.match(copy.body, /Home|home|business/i);
    assert.equal(copy.agentView, undefined);
  });
});
