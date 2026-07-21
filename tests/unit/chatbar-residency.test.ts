import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHATBAR_EDGE_ALIGNS,
  CHATBAR_EDGE_PRESET_OFFSETS,
  CHATBAR_RESIDENCY_MODES,
  CHATBAR_SIDES,
  DEFAULT_CHATBAR_EDGE_ALIGN,
  DEFAULT_CHATBAR_EDGE_OFFSET,
  DEFAULT_CHATBAR_RESIDENCY,
  DEFAULT_CHATBAR_SIDE,
  edgeOffsetToTopPx,
  loadChatbarEdgeAlign,
  loadChatbarEdgeOffset,
  loadChatbarResidency,
  loadChatbarSide,
  normalizeChatbarEdgeAlign,
  normalizeChatbarEdgeOffset,
  normalizeChatbarResidency,
  normalizeChatbarSide,
  offsetForEdgeAlign,
  saveChatbarEdgeAlign,
  saveChatbarEdgeOffset,
  saveChatbarResidency,
  saveChatbarSide,
  snapEdgeOffset,
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

describe("chatbar edge placement", () => {
  it("clamps edge offset to 0..1", () => {
    assert.equal(normalizeChatbarEdgeOffset(null), DEFAULT_CHATBAR_EDGE_OFFSET);
    assert.equal(normalizeChatbarEdgeOffset("nope"), DEFAULT_CHATBAR_EDGE_OFFSET);
    assert.equal(normalizeChatbarEdgeOffset(-0.2), 0);
    assert.equal(normalizeChatbarEdgeOffset(1.5), 1);
    assert.equal(normalizeChatbarEdgeOffset("0.25"), 0.25);
  });

  it("normalizes edge align values", () => {
    assert.equal(normalizeChatbarEdgeAlign(null), DEFAULT_CHATBAR_EDGE_ALIGN);
    assert.equal(normalizeChatbarEdgeAlign("top"), CHATBAR_EDGE_ALIGNS.TOP);
    assert.equal(normalizeChatbarEdgeAlign("bottom"), CHATBAR_EDGE_ALIGNS.BOTTOM);
    assert.equal(normalizeChatbarEdgeAlign("custom"), CHATBAR_EDGE_ALIGNS.CUSTOM);
    assert.equal(normalizeChatbarEdgeAlign("sideways"), CHATBAR_EDGE_ALIGNS.MIDDLE);
  });

  it("maps presets to offsets", () => {
    assert.equal(offsetForEdgeAlign("top"), CHATBAR_EDGE_PRESET_OFFSETS.top);
    assert.equal(offsetForEdgeAlign("middle"), CHATBAR_EDGE_PRESET_OFFSETS.middle);
    assert.equal(offsetForEdgeAlign("bottom"), CHATBAR_EDGE_PRESET_OFFSETS.bottom);
    assert.equal(offsetForEdgeAlign("custom", 0.33), 0.33);
  });

  it("magnetically snaps near presets", () => {
    const nearMiddle = snapEdgeOffset(0.52);
    assert.equal(nearMiddle.align, CHATBAR_EDGE_ALIGNS.MIDDLE);
    assert.equal(nearMiddle.offset, CHATBAR_EDGE_PRESET_OFFSETS.middle);

    const free = snapEdgeOffset(0.35);
    assert.equal(free.align, CHATBAR_EDGE_ALIGNS.CUSTOM);
    assert.equal(free.offset, 0.35);
  });

  it("maps offset to top px within safe insets", () => {
    // vh=1000, safeTop=100, safeBottom=100 → usable 800; offset 0.5 → 100+400=500
    assert.equal(edgeOffsetToTopPx(0.5, 1000, 100, 100), 500);
    assert.equal(edgeOffsetToTopPx(0, 1000, 100, 100), 100);
    assert.equal(edgeOffsetToTopPx(1, 1000, 100, 100), 900);
  });

  it("persists edge offset and align", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    assert.equal(loadChatbarEdgeOffset(storage), DEFAULT_CHATBAR_EDGE_OFFSET);
    assert.equal(loadChatbarEdgeAlign(storage), DEFAULT_CHATBAR_EDGE_ALIGN);
    saveChatbarEdgeOffset(0.2, storage);
    saveChatbarEdgeAlign("top", storage);
    assert.equal(loadChatbarEdgeOffset(storage), 0.2);
    assert.equal(loadChatbarEdgeAlign(storage), "top");
  });
});
