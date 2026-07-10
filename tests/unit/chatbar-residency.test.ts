import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHATBAR_RESIDENCY_MODES,
  CHATBAR_SIDES,
  DEFAULT_CHATBAR_RESIDENCY,
  DEFAULT_CHATBAR_SIDE,
  loadChatbarResidency,
  loadChatbarSide,
  normalizeChatbarResidency,
  normalizeChatbarSide,
  saveChatbarResidency,
  saveChatbarSide,
  toggleChatbarResidency,
  toggleChatbarSide,
} from "../../lib/chatbar/residency.ts";

describe("chatbar residency", () => {
  it("normalizes unknown values to default open", () => {
    assert.equal(normalizeChatbarResidency(null), DEFAULT_CHATBAR_RESIDENCY);
    assert.equal(normalizeChatbarResidency("nope"), CHATBAR_RESIDENCY_MODES.OPEN);
    assert.equal(normalizeChatbarResidency("collapsed"), CHATBAR_RESIDENCY_MODES.COLLAPSED);
  });

  it("toggles between open and collapsed", () => {
    assert.equal(toggleChatbarResidency("open"), "collapsed");
    assert.equal(toggleChatbarResidency("collapsed"), "open");
  });

  it("persists through a memory storage stand-in", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    assert.equal(loadChatbarResidency(storage), DEFAULT_CHATBAR_RESIDENCY);
    saveChatbarResidency("collapsed", storage);
    assert.equal(loadChatbarResidency(storage), "collapsed");
    saveChatbarResidency("open", storage);
    assert.equal(loadChatbarResidency(storage), "open");
  });
});

describe("chatbar side", () => {
  it("defaults to right and normalizes left/right", () => {
    assert.equal(normalizeChatbarSide(null), DEFAULT_CHATBAR_SIDE);
    assert.equal(normalizeChatbarSide("left"), CHATBAR_SIDES.LEFT);
    assert.equal(normalizeChatbarSide("right"), CHATBAR_SIDES.RIGHT);
    assert.equal(normalizeChatbarSide("top"), CHATBAR_SIDES.RIGHT);
  });

  it("swaps sides", () => {
    assert.equal(toggleChatbarSide("right"), "left");
    assert.equal(toggleChatbarSide("left"), "right");
  });

  it("persists side preference", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    assert.equal(loadChatbarSide(storage), DEFAULT_CHATBAR_SIDE);
    saveChatbarSide("left", storage);
    assert.equal(loadChatbarSide(storage), "left");
    saveChatbarSide("right", storage);
    assert.equal(loadChatbarSide(storage), "right");
  });
});
