import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDeleteProcessConversation,
  defaultForkTitle,
  messagesToCopyForFork,
} from "../../lib/conversation-fork.ts";

describe("conversation-fork helpers (3.4)", () => {
  it("copies all messages when no fork point", () => {
    const messages = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(messagesToCopyForFork(messages), messages);
  });

  it("copies messages through the fork point inclusive", () => {
    const messages = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(messagesToCopyForFork(messages, "b"), [
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("falls back to full history when fork message is missing", () => {
    const messages = [{ id: "a" }, { id: "b" }];
    assert.deepEqual(messagesToCopyForFork(messages, "missing"), messages);
  });

  it("builds default fork titles", () => {
    assert.equal(defaultForkTitle("Main"), 'Fork of "Main"');
    assert.equal(
      defaultForkTitle("Main", true),
      "Fork from message · Main",
    );
  });

  it("requires more than one conversation to delete", () => {
    assert.equal(canDeleteProcessConversation(1), false);
    assert.equal(canDeleteProcessConversation(2), true);
  });
});
