import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAutomationSessionBinding } from "../../lib/chatbar/automation-session.ts";

describe("isAutomationSessionBinding", () => {
  it("accepts a minimal valid binding", () => {
    const ok = isAutomationSessionBinding({
      processId: "p1",
      processName: "Content cycle",
      messages: [],
      isLoading: false,
      onSend: () => {},
      onOpenConnection: () => {},
    });
    assert.equal(ok, true);
  });

  it("rejects incomplete objects", () => {
    assert.equal(isAutomationSessionBinding(null), false);
    assert.equal(isAutomationSessionBinding({ processId: "p1" }), false);
    assert.equal(
      isAutomationSessionBinding({
        processId: "",
        processName: "x",
        messages: [],
        onSend: () => {},
        onOpenConnection: () => {},
      }),
      false,
    );
  });
});
