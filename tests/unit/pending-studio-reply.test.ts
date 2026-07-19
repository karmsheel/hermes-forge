import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  consumePendingStudioReply,
  peekPendingStudioReply,
  setPendingStudioReply,
} from "../../lib/chatbar/pending-studio-reply.ts";

describe("pending-studio-reply", () => {
  beforeEach(() => {
    // jsdom / node test env may not have sessionStorage; polyfill lightly
    const store = new Map<string, string>();
    // @ts-expect-error test polyfill
    globalThis.sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
  });

  it("set / peek / consume round-trip", () => {
    setPendingStudioReply({
      conversationId: "conv-1",
      businessId: "biz-1",
      hermesAgentProfileId: "agent-1",
    });
    const peeked = peekPendingStudioReply();
    assert.equal(peeked?.conversationId, "conv-1");
    assert.equal(peeked?.businessId, "biz-1");
    assert.equal(peeked?.hermesAgentProfileId, "agent-1");

    const consumed = consumePendingStudioReply();
    assert.equal(consumed?.conversationId, "conv-1");
    assert.equal(peekPendingStudioReply(), null);
  });

  it("rejects malformed payloads", () => {
    sessionStorage.setItem("pendingStudioReply", JSON.stringify({ foo: 1 }));
    assert.equal(peekPendingStudioReply(), null);
  });
});
