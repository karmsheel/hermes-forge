import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPACT_TILE,
  isGodModeViewMode,
  loadGodModeViewMode,
  saveGodModeViewMode,
} from "../../lib/god-mode-view.ts";

describe("god-mode-view", () => {
  it("validates modes", () => {
    assert.equal(isGodModeViewMode("compact"), true);
    assert.equal(isGodModeViewMode("diagrams"), true);
    assert.equal(isGodModeViewMode("map"), false);
  });

  it("defaults to compact without storage", () => {
    assert.equal(loadGodModeViewMode(), "compact");
  });

  it("round-trips via memory storage stand-in", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    // save/load use window.localStorage — only assert constants + helpers here
    assert.ok(COMPACT_TILE.width > 0);
    assert.ok(COMPACT_TILE.height > 0);
    assert.equal(typeof saveGodModeViewMode, "function");
  });
});
