import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChatSystemPrompt } from "../../lib/diagram.ts";

/**
 * Smoke: process system prompt still builds (catalog / turn runner depend on it).
 * Full streamProcessChatTurn needs DB + Hermes — covered by route integration.
 */
describe("process chat turn helpers", () => {
  it("buildChatSystemPrompt produces analyst framing for workshop pack", () => {
    const system = buildChatSystemPrompt({
      processName: "Order flow",
      description: "Take orders",
      nameStatus: "confirmed",
      status: "draft",
      hasDiagram: false,
      shouldAskAccuracy: false,
    });
    assert.match(system, /Business Process Analyst|process/i);
    assert.match(system, /Order flow|ONE specific business process/i);
  });
});
