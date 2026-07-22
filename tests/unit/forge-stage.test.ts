import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultStageForPath,
  HOLISTIC_NAV_IDS,
  isForgeStage,
  isNavIdInStage,
  LEADING_ROOMS,
  OPS_ROOMS,
  pathBelongsToStage,
  STAGE_DEFAULT_ROUTES,
  stageFromPath,
} from "../../lib/forge-stage.ts";

describe("forge-stage (rooms)", () => {
  it("recognizes room ids including foundation and inventory", () => {
    assert.equal(isForgeStage("foundation"), true);
    assert.equal(isForgeStage("inventory"), true);
    assert.equal(isForgeStage("map"), true);
    assert.equal(isForgeStage("monitor"), true);
    assert.equal(isForgeStage("automate"), true);
    assert.equal(isForgeStage("run"), false);
  });

  it("splits leading vs operating rooms", () => {
    assert.deepEqual([...LEADING_ROOMS], ["foundation", "inventory"]);
    assert.deepEqual([...OPS_ROOMS], ["map", "monitor", "automate"]);
  });

  it("infers room from paths", () => {
    assert.equal(stageFromPath("/foundation"), "foundation");
    assert.equal(stageFromPath("/sessions"), "foundation");
    assert.equal(stageFromPath("/workshop"), "map");
    assert.equal(stageFromPath("/functions"), "map");
    assert.equal(stageFromPath("/god-mode"), "map");
    assert.equal(stageFromPath("/documents"), null);
    assert.equal(stageFromPath("/metrics"), "monitor");
    assert.equal(stageFromPath("/cronalytics"), "monitor");
    assert.equal(stageFromPath("/automations/abc"), "automate");
    assert.equal(stageFromPath("/automation-analysis"), "automate");
    assert.equal(stageFromPath("/content"), "inventory");
    assert.equal(stageFromPath("/inventory/home"), "inventory");
    assert.equal(stageFromPath("/home"), "foundation");
    assert.equal(stageFromPath("/map/home"), "map");
    assert.equal(stageFromPath("/monitor/home"), "monitor");
    assert.equal(stageFromPath("/automate/home"), "automate");
    assert.equal(stageFromPath("/decisions"), null);
  });

  it("defaults neutral paths to foundation", () => {
    assert.equal(defaultStageForPath("/home"), "foundation");
    assert.equal(defaultStageForPath("/decisions"), "foundation");
  });

  it("room switch lands on each room Home", () => {
    assert.equal(STAGE_DEFAULT_ROUTES.foundation, "/home");
    assert.equal(STAGE_DEFAULT_ROUTES.inventory, "/inventory/home");
    assert.equal(STAGE_DEFAULT_ROUTES.map, "/map/home");
    assert.equal(STAGE_DEFAULT_ROUTES.monitor, "/monitor/home");
    assert.equal(STAGE_DEFAULT_ROUTES.automate, "/automate/home");
  });

  it("filters nav by room", () => {
    assert.equal(isNavIdInStage("home", "foundation"), true);
    assert.equal(isNavIdInStage("home", "map"), true);
    assert.equal(isNavIdInStage("home", "monitor"), true);
    assert.equal(isNavIdInStage("home", "automate"), true);
    assert.equal(isNavIdInStage("home", "inventory"), true);
    assert.equal(isNavIdInStage("foundation", "foundation"), true);
    assert.equal(isNavIdInStage("foundation", "map"), false);
    assert.equal(isNavIdInStage("god-mode", "map"), true);
    assert.equal(isNavIdInStage("workshop", "map"), true);
    assert.equal(isNavIdInStage("workshop", "foundation"), false);
    assert.equal(isNavIdInStage("metrics", "map"), false);
    // Content only in Inventory
    assert.equal(isNavIdInStage("content", "inventory"), true);
    assert.equal(isNavIdInStage("content", "monitor"), false);
    assert.equal(isNavIdInStage("content", "automate"), false);
    assert.equal(isNavIdInStage("content", "map"), false);
    assert.equal(isNavIdInStage("content", "foundation"), false);
    assert.equal(isNavIdInStage("automations", "automate"), true);
    assert.equal(isNavIdInStage("automation-analysis", "automate"), true);
    assert.equal(isNavIdInStage("automation-analysis", "map"), false);
    assert.equal(isNavIdInStage("documents", "monitor"), false);
    assert.equal(isNavIdInStage("documents", "foundation"), true);
    assert.equal(isNavIdInStage("documents", "map"), false);
    assert.equal(isNavIdInStage("sessions", "foundation"), true);
    assert.equal(isNavIdInStage("sessions", "map"), false);
    assert.equal(isNavIdInStage("sessions", "monitor"), false);
    assert.equal(isNavIdInStage("personnel", "foundation"), true);
    assert.equal(isNavIdInStage("personnel", "map"), false);
    assert.equal(isNavIdInStage("personnel", "automate"), true);
    // log/decisions are holistic footer items, not room-scoped
    assert.equal(isNavIdInStage("decisions", "map"), false);
    assert.equal(isNavIdInStage("log", "monitor"), false);
    assert.deepEqual([...HOLISTIC_NAV_IDS], ["decisions", "log"]);
  });

  it("pathBelongsToStage for content, home, documents", () => {
    assert.equal(pathBelongsToStage("/content", "inventory"), true);
    assert.equal(pathBelongsToStage("/content", "monitor"), false);
    assert.equal(pathBelongsToStage("/content", "automate"), false);
    assert.equal(pathBelongsToStage("/content", "map"), false);
    assert.equal(pathBelongsToStage("/inventory/home", "inventory"), true);
    assert.equal(pathBelongsToStage("/inventory/home", "foundation"), false);
    assert.equal(pathBelongsToStage("/home", "foundation"), true);
    assert.equal(pathBelongsToStage("/home", "map"), false);
    assert.equal(pathBelongsToStage("/map/home", "map"), true);
    assert.equal(pathBelongsToStage("/map/home", "foundation"), false);
    assert.equal(pathBelongsToStage("/monitor/home", "monitor"), true);
    assert.equal(pathBelongsToStage("/automate/home", "automate"), true);
    assert.equal(pathBelongsToStage("/workshop", "map"), true);
    assert.equal(pathBelongsToStage("/workshop", "automate"), false);
    assert.equal(pathBelongsToStage("/foundation", "foundation"), true);
    assert.equal(pathBelongsToStage("/foundation", "map"), false);
    assert.equal(pathBelongsToStage("/god-mode", "map"), true);
    assert.equal(pathBelongsToStage("/documents", "foundation"), true);
    assert.equal(pathBelongsToStage("/documents", "map"), false);
    assert.equal(pathBelongsToStage("/sessions", "foundation"), true);
    assert.equal(pathBelongsToStage("/sessions", "map"), false);
    assert.equal(pathBelongsToStage("/personnel", "foundation"), true);
    assert.equal(pathBelongsToStage("/personnel", "map"), false);
    assert.equal(pathBelongsToStage("/personnel", "automate"), true);
    assert.equal(pathBelongsToStage("/decisions", "map"), true);
    assert.equal(pathBelongsToStage("/decisions", "monitor"), true);
    assert.equal(pathBelongsToStage("/decisions", "automate"), true);
  });
});
