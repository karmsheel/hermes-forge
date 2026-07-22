// tests/unit/page-name.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageNameFromPath } from "../../lib/page-name.ts";
import { ROOM_HOME_COPY } from "../../lib/room-home.ts";

describe("pageNameFromPath", () => {
  it("returns room home badges for room home routes", () => {
    assert.equal(pageNameFromPath("/home"), ROOM_HOME_COPY.foundation.roomBadge);
    assert.equal(pageNameFromPath("/"), ROOM_HOME_COPY.foundation.roomBadge);
    assert.equal(pageNameFromPath("/inventory/home"), ROOM_HOME_COPY.inventory.roomBadge);
    assert.equal(pageNameFromPath("/map/home"), ROOM_HOME_COPY.map.roomBadge);
    assert.equal(pageNameFromPath("/monitor/home"), ROOM_HOME_COPY.monitor.roomBadge);
    assert.equal(pageNameFromPath("/automate/home"), ROOM_HOME_COPY.automate.roomBadge);
  });

  it("returns stable nav labels for primary shell routes", () => {
    assert.equal(pageNameFromPath("/home-combined"), "Home Combined");
    assert.equal(pageNameFromPath("/foundation"), "Foundation");
    assert.equal(pageNameFromPath("/god-mode"), "Plant");
    assert.equal(pageNameFromPath("/functions"), "Functions");
    assert.equal(pageNameFromPath("/workshop"), "Workshop");
    assert.equal(pageNameFromPath("/workshop?processId=abc"), "Workshop");
    assert.equal(pageNameFromPath("/personnel"), "Personnel");
    assert.equal(pageNameFromPath("/personnel/hire"), "Personnel");
    assert.equal(pageNameFromPath("/personnel/academy"), "Personnel");
    assert.equal(pageNameFromPath("/documents"), "Documents");
    assert.equal(pageNameFromPath("/sessions"), "Sessions");
    assert.equal(pageNameFromPath("/metrics"), "Metrics");
    assert.equal(pageNameFromPath("/content"), "Content");
    assert.equal(pageNameFromPath("/automations"), "Automations");
    assert.equal(pageNameFromPath("/automations/proc_1"), "Automations");
    assert.equal(pageNameFromPath("/automation-analysis"), "Automation Analysis");
    assert.equal(pageNameFromPath("/cronalytics"), "Cronalytics");
    assert.equal(pageNameFromPath("/decisions"), "Decisions");
    assert.equal(pageNameFromPath("/log"), "Business log");
  });

  it("returns null for full-bleed / excluded routes", () => {
    assert.equal(pageNameFromPath("/business-manager"), null);
    assert.equal(pageNameFromPath("/setup/overlord"), null);
    assert.equal(pageNameFromPath("/login"), null);
    // /login excluded before /log prefix — must not become "Business log"
    assert.equal(pageNameFromPath("/login/callback"), null);
  });

  it("uses segment-safe prefix matching (not string prefix)", () => {
    // /content-hub must not match /content → "Content"
    assert.equal(pageNameFromPath("/content-hub"), "Content hub");
    assert.equal(pageNameFromPath("/content"), "Content");
    assert.equal(pageNameFromPath("/content/posts"), "Content");
    // /log matches Business log; sibling segments do not
    assert.equal(pageNameFromPath("/log"), "Business log");
    assert.equal(pageNameFromPath("/log/entry"), "Business log");
  });

  it("strips query strings before matching", () => {
    assert.equal(pageNameFromPath("/functions?x=1"), "Functions");
  });

  it("title-cases unknown first segment as fallback", () => {
    assert.equal(pageNameFromPath("/some-new-page"), "Some new page");
  });
});
