import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeHermesUsage,
  formatLastTurnUsageLabel,
} from "../../lib/chatbar/usage.ts";

describe("normalizeHermesUsage", () => {
  it("reads chat.completions usage", () => {
    const u = normalizeHermesUsage({
      prompt_tokens: 50,
      completion_tokens: 200,
      total_tokens: 250,
    });
    assert.equal(u?.promptTokens, 50);
    assert.equal(u?.completionTokens, 200);
    assert.equal(u?.totalTokens, 250);
    assert.equal(u?.source, "chat_completions");
  });

  it("reads responses/runs usage", () => {
    const u = normalizeHermesUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    });
    assert.equal(u?.promptTokens, 10);
    assert.equal(u?.completionTokens, 20);
    assert.equal(u?.totalTokens, 30);
    assert.equal(u?.source, "responses");
  });

  it("unwraps nested usage objects", () => {
    const u = normalizeHermesUsage({
      usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
    });
    assert.equal(u?.promptTokens, 5);
    assert.equal(u?.totalTokens, 6);
  });

  it("returns null for empty", () => {
    assert.equal(normalizeHermesUsage(null), null);
    assert.equal(normalizeHermesUsage({}), null);
    assert.equal(normalizeHermesUsage(undefined), null);
  });
});

describe("formatLastTurnUsageLabel", () => {
  it("formats prompt tokens", () => {
    const label = formatLastTurnUsageLabel({
      promptTokens: 18400,
      completionTokens: 200,
      totalTokens: 18600,
      source: "chat_completions",
    });
    assert.match(label, /Last turn/i);
    assert.match(label, /18\.4k|18400|18k/i);
  });
});
