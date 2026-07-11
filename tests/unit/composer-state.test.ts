import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  busyComposerSubmitAction,
  composerControlState,
  composerKeyAction,
  queuedMessageControlState,
  resolveComposerSubmitAction,
  shouldAutoFlushQueuedTurn,
} from "../../lib/chatbar/composer-state.ts";

describe("composerControlState", () => {
  it("shows send when idle with draft and connected", () => {
    const s = composerControlState({
      connected: true,
      sending: false,
      draftText: "hello",
    });
    assert.equal(s.controls.inlineSend.hidden, false);
    assert.equal(s.controls.inlineSend.disabled, false);
    assert.equal(s.controls.stop.hidden, true);
    assert.equal(s.controls.queue.hidden, true);
    assert.equal(s.controls.steer.hidden, true);
  });

  it("shows stop only while sending with empty draft", () => {
    const s = composerControlState({
      connected: true,
      sending: true,
      draftText: "",
    });
    assert.equal(s.controls.inlineSend.hidden, true);
    assert.equal(s.controls.stop.hidden, false);
    assert.equal(s.controls.stop.disabled, false);
    assert.equal(s.controls.queue.hidden, true);
  });

  it("shows stop + queue while sending with draft (steer off by default)", () => {
    const s = composerControlState({
      connected: true,
      sending: true,
      draftText: "follow up",
      canSteer: false,
    });
    assert.equal(s.busyDraft, true);
    assert.equal(s.controls.stop.hidden, false);
    assert.equal(s.controls.queue.hidden, false);
    assert.equal(s.controls.queue.disabled, false);
    assert.equal(s.controls.steer.hidden, true);
  });

  it("shows steer when busy + draft + canSteer", () => {
    const s = composerControlState({
      connected: true,
      sending: true,
      draftText: "steer this",
      canSteer: true,
    });
    assert.equal(s.controls.steer.hidden, false);
    assert.equal(s.controls.steer.disabled, false);
  });

  it("disables send when disconnected", () => {
    const s = composerControlState({
      connected: false,
      sending: false,
      draftText: "hi",
    });
    assert.equal(s.controls.inlineSend.disabled, true);
  });
});

describe("busyComposerSubmitAction", () => {
  it("returns send when not busy", () => {
    assert.equal(busyComposerSubmitAction({ sending: false, draftText: "a" }), "send");
  });

  it("queues busy draft when steer unavailable", () => {
    assert.equal(
      busyComposerSubmitAction({
        sending: true,
        draftText: "later",
        canSteer: false,
      }),
      "queue",
    );
  });

  it("steers busy text-only draft when canSteer", () => {
    assert.equal(
      busyComposerSubmitAction({
        sending: true,
        draftText: "pivot",
        canSteer: true,
      }),
      "steer",
    );
  });

  it("ignores empty busy submit", () => {
    assert.equal(busyComposerSubmitAction({ sending: true, draftText: "" }), "ignore");
  });
});

describe("composerKeyAction", () => {
  it("maps Enter to submit", () => {
    assert.equal(composerKeyAction({ key: "Enter" }, { sending: false }), "submit");
  });

  it("ignores Shift+Enter", () => {
    assert.equal(
      composerKeyAction({ key: "Enter", shiftKey: true }, { sending: false }),
      "none",
    );
  });

  it("maps Ctrl+Enter while sending to busy action", () => {
    assert.equal(
      composerKeyAction(
        { key: "Enter", ctrlKey: true },
        { sending: true, draftText: "q", canSteer: false },
      ),
      "queue",
    );
  });
});

describe("resolveComposerSubmitAction", () => {
  it("aliases busyComposerSubmitAction", () => {
    assert.equal(
      resolveComposerSubmitAction({ sending: true, draftText: "x" }),
      "queue",
    );
  });
});

describe("queuedMessageControlState + shouldAutoFlushQueuedTurn", () => {
  it("hides steer when canSteer is false", () => {
    const s = queuedMessageControlState({ sending: true, text: "hi", canSteer: false });
    assert.equal(s.steer.hidden, true);
    assert.equal(s.delete.hidden, false);
  });

  it("auto-flushes normal queue items", () => {
    assert.equal(shouldAutoFlushQueuedTurn({ autoSend: true, kind: "queued" }), true);
    assert.equal(shouldAutoFlushQueuedTurn({ kind: "steer-fallback" }), false);
    assert.equal(shouldAutoFlushQueuedTurn(null), false);
  });
});
