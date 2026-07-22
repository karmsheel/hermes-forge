import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeHermesMessage,
  normalizeHermesSession,
  sessionDisplayTitle,
} from "../../lib/hermes-sessions.ts";

describe("normalizeHermesSession", () => {
  it("normalizes a flat session row", () => {
    const s = normalizeHermesSession({
      id: "api_123",
      source: "api_server",
      title: "Mobile chat",
      message_count: 2,
      input_tokens: 50,
      output_tokens: 200,
      end_reason: null,
      parent_session_id: null,
      last_active: 1_700_000_000,
      preview: "hello",
      has_system_prompt: true,
      has_model_config: false,
    });
    assert.ok(s);
    assert.equal(s!.id, "api_123");
    assert.equal(s!.source, "api_server");
    assert.equal(s!.title, "Mobile chat");
    assert.equal(s!.messageCount, 2);
    assert.equal(s!.inputTokens, 50);
    assert.equal(s!.outputTokens, 200);
    assert.equal(s!.preview, "hello");
    assert.equal(s!.hasSystemPrompt, true);
    assert.equal(s!.hasModelConfig, false);
    assert.ok(s!.lastActive?.includes("T") || s!.lastActive);
  });

  it("unwraps nested session object", () => {
    const s = normalizeHermesSession({
      object: "hermes.session",
      session: { id: "fork-1", title: "Alternative", parent_session_id: "src" },
    });
    assert.ok(s);
    assert.equal(s!.id, "fork-1");
    assert.equal(s!.title, "Alternative");
    assert.equal(s!.parentSessionId, "src");
  });

  it("returns null without id", () => {
    assert.equal(normalizeHermesSession({ title: "x" }), null);
    assert.equal(normalizeHermesSession(null), null);
  });
});

describe("normalizeHermesMessage", () => {
  it("normalizes role and content", () => {
    const m = normalizeHermesMessage({
      id: "m1",
      role: "user",
      content: "hello from phone",
      session_id: "api_123",
      timestamp: 1700000000,
    });
    assert.ok(m);
    assert.equal(m!.role, "user");
    assert.equal(m!.content, "hello from phone");
    assert.equal(m!.sessionId, "api_123");
  });

  it("flattens multimodal content parts", () => {
    const m = normalizeHermesMessage({
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        { type: "image_url", image_url: { url: "data:..." } },
      ],
    });
    assert.ok(m);
    assert.match(m!.content, /What's in this image/);
  });
});

describe("sessionDisplayTitle", () => {
  it("prefers title, then preview, then id", () => {
    assert.equal(
      sessionDisplayTitle({ id: "a", title: "Named" }),
      "Named",
    );
    assert.equal(
      sessionDisplayTitle({ id: "a", title: null, preview: "snippet text" }),
      "snippet text",
    );
    assert.equal(sessionDisplayTitle({ id: "a" }), "a");
  });
});
