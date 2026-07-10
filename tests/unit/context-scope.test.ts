import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHATBAR_CONTEXT_MODES,
  contextModeLabel,
  normalizeChatbarContextMode,
} from "../../lib/chatbar/context-scope.ts";
import { introKey } from "../../lib/chatbar/intros.ts";

describe("context scope", () => {
  it("normalizes known modes", () => {
    assert.equal(
      normalizeChatbarContextMode("chat-only"),
      CHATBAR_CONTEXT_MODES.CHAT_ONLY,
    );
    assert.equal(
      normalizeChatbarContextMode("follow-page"),
      CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
    );
    assert.equal(
      normalizeChatbarContextMode("pinned-entity"),
      CHATBAR_CONTEXT_MODES.PINNED_ENTITY,
    );
  });

  it("defaults unknown modes to follow-page", () => {
    assert.equal(
      normalizeChatbarContextMode("nope"),
      CHATBAR_CONTEXT_MODES.FOLLOW_PAGE,
    );
  });

  it("labels modes", () => {
    assert.equal(contextModeLabel(CHATBAR_CONTEXT_MODES.CHAT_ONLY), "Chat only");
    assert.equal(contextModeLabel(CHATBAR_CONTEXT_MODES.FOLLOW_PAGE), "Follow page");
  });
});

describe("intro keys", () => {
  it("scopes by business and route", () => {
    assert.equal(introKey("biz1", "home"), "biz1::home");
  });
});
