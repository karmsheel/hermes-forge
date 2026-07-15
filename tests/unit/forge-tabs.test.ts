import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORGE_TABS_STORAGE_KEY,
  buildTab,
  formatTabTitle,
  isValidForgeTab,
  loadForgeTabsState,
  normalizeShellRoute,
  routePageLabel,
  saveForgeTabsState,
} from "../../lib/forge-tabs/index.ts";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    map,
  };
}

describe("forge-tabs routes and titles", () => {
  it("normalizes shell routes", () => {
    assert.equal(normalizeShellRoute("/workshop/"), "/workshop");
    assert.equal(normalizeShellRoute("/"), "/home");
    assert.equal(normalizeShellRoute("functions"), "/functions");
    assert.equal(normalizeShellRoute("/home?x=1"), "/home?x=1");
  });

  it("labels routes for tab titles", () => {
    assert.equal(routePageLabel("/workshop"), "Workshop");
    assert.equal(routePageLabel("/foundation"), "Foundation");
    assert.equal(routePageLabel("/automations/abc"), "Automation");
    assert.equal(routePageLabel("/log"), "Business log");
  });

  it("formats business · page titles", () => {
    assert.equal(formatTabTitle("Acme", "/workshop"), "Acme · Workshop");
    assert.equal(
      formatTabTitle("Acme", "/workshop", "Onboarding"),
      "Acme · Onboarding",
    );
  });

  it("builds tabs with ids and titles", () => {
    const tab = buildTab({
      route: "/workshop",
      businessId: "b1",
      businessName: "Acme",
      processName: "Hire",
    });
    assert.equal(tab.businessId, "b1");
    assert.equal(tab.route, "/workshop");
    assert.equal(tab.title, "Acme · Hire");
    assert.ok(tab.id.length > 0);
    assert.equal(isValidForgeTab(tab), true);
    assert.equal(isValidForgeTab({ id: "x" }), false);
  });

  it("stores optional business avatar on tabs", () => {
    const withEmoji = buildTab({
      route: "/home",
      businessId: "b1",
      businessName: "Acme",
      avatarEmoji: "🚀",
    });
    assert.equal(withEmoji.avatarEmoji, "🚀");
    assert.equal(withEmoji.avatarIcon, null);

    const withIcon = buildTab({
      route: "/home",
      businessId: "b2",
      businessName: "Beta",
      avatarIcon: "rocket",
    });
    assert.equal(withIcon.avatarEmoji, null);
    assert.equal(withIcon.avatarIcon, "rocket");
    assert.equal(isValidForgeTab(withEmoji), true);
    assert.equal(isValidForgeTab(withIcon), true);
  });
});

describe("forge-tabs storage", () => {
  it("round-trips tabs through storage stand-in", () => {
    const storage = memoryStorage();
    const tab = buildTab({
      id: "t1",
      route: "/home",
      businessId: "b1",
      businessName: "Acme",
    });
    saveForgeTabsState({ tabs: [tab], activeTabId: "t1" }, storage);
    const loaded = loadForgeTabsState(storage);
    assert.ok(loaded);
    assert.equal(loaded!.version, 1);
    assert.equal(loaded!.activeTabId, "t1");
    assert.equal(loaded!.tabs[0]!.title, "Acme · Home");
    assert.equal(storage.map.has(FORGE_TABS_STORAGE_KEY), true);
  });

  it("rejects corrupt payloads", () => {
    const storage = memoryStorage();
    storage.setItem(FORGE_TABS_STORAGE_KEY, "{not-json");
    assert.equal(loadForgeTabsState(storage), null);
    storage.setItem(FORGE_TABS_STORAGE_KEY, JSON.stringify({ version: 1, tabs: [] }));
    assert.equal(loadForgeTabsState(storage), null);
  });

  it("falls back active id when missing", () => {
    const storage = memoryStorage();
    const tab = buildTab({
      id: "only",
      route: "/functions",
      businessId: "b1",
      businessName: "Biz",
    });
    storage.setItem(
      FORGE_TABS_STORAGE_KEY,
      JSON.stringify({ version: 1, tabs: [tab], activeTabId: "gone" }),
    );
    const loaded = loadForgeTabsState(storage);
    assert.equal(loaded?.activeTabId, "only");
  });
});
