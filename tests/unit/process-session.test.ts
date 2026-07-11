import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProcessSessionBinding } from "../../lib/chatbar/process-session.ts";

describe("isProcessSessionBinding", () => {
  it("accepts a minimal valid binding", () => {
    const ok = isProcessSessionBinding({
      processId: "p1",
      processName: "Intake",
      conversationId: null,
      conversations: [],
      messages: [],
      isLoading: false,
      onSend: () => {},
      onSelectConversation: () => {},
      onOpenConnection: () => {},
    });
    assert.equal(ok, true);
  });

  it("rejects incomplete objects", () => {
    assert.equal(isProcessSessionBinding(null), false);
    assert.equal(isProcessSessionBinding({ processId: "p1" }), false);
    assert.equal(
      isProcessSessionBinding({
        processId: "",
        processName: "x",
        messages: [],
        onSend: () => {},
        onSelectConversation: () => {},
        onOpenConnection: () => {},
      }),
      false,
    );
  });
});
