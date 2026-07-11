import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contextMeterDisplay,
  estimateStudioPromptTokens,
  estimateTokens,
  formatContextMeter,
} from "../../lib/chatbar/context-meter.ts";

describe("estimateTokens", () => {
  it("uses ~4 chars per token", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("a".repeat(40)), 10);
  });
});

describe("formatContextMeter", () => {
  it("marks high usage critical", () => {
    const m = formatContextMeter({ estimatedTokens: 95_000, modelContextTokens: 100_000 });
    assert.equal(m.level, "critical");
    assert.ok((m.percentUsed ?? 0) >= 90);
  });

  it("handles unknown limit", () => {
    const m = formatContextMeter({ estimatedTokens: 100, modelContextTokens: 0 });
    assert.equal(m.level, "unknown");
    assert.equal(m.percentUsed, null);
  });
});

describe("estimateStudioPromptTokens + display", () => {
  it("grows with messages and draft", () => {
    const empty = estimateStudioPromptTokens({ messages: [], draftText: "" });
    const full = estimateStudioPromptTokens({
      messages: [{ role: "user", content: "x".repeat(400) }],
      draftText: "y".repeat(400),
      contextText: "z".repeat(400),
    });
    assert.ok(full > empty);
  });

  it("builds a human detail string", () => {
    const d = contextMeterDisplay({
      messages: [{ content: "hello world" }],
      draftText: "more",
      modelContextTokens: 128_000,
    });
    assert.match(d.detail, /\//);
    assert.match(d.title, /estimate/i);
    assert.equal(d.level, "ok");
  });
});
