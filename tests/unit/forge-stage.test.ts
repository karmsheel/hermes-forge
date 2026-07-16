import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultStageForPath,
  HOLISTIC_NAV_IDS,
  isForgeStage,
  isNavIdInStage,
  pathBelongsToStage,
  STAGE_DEFAULT_ROUTES,
  stageFromPath,
} from "../../lib/forge-stage.ts";

describe("forge-stage (rooms)", () => {
  it("recognizes room ids including foundation", () => {
    assert.equal(isForgeStage("foundation"), true);
    assert.equal(isForgeStage("map"), true);
    assert.equal(isForgeStage("monitor"), true);
    assert.equal(isForgeStage("automate"), true);
    assert.equal(isForgeStage("run"), false);
  });

  it("infers room from paths", () => {
    assert.equal(stageFromPath("/foundation"), "foundation");
    assert.equal(stageFromPath("/workshop"), "map");
    assert.equal(stageFromPath("/functions"), "map");
    assert.equal(stageFromPath("/god-mode"), "map");
    assert.equal(stageFromPath("/documents"), null);
    assert.equal(stageFromPath("/metrics"), "monitor");
    assert.equal(stageFromPath("/cronalytics"), "monitor");
    assert.equal(stageFromPath("/automations/abc"), "automate");
    assert.equal(stageFromPath("/automation-analysis"), "automate");
    assert.equal(stageFromPath("/content"), null);
    assert.equal(stageFromPath("/home"), null);
    assert.equal(stageFromPath("/decisions"), null);
  });

  it("defaults neutral paths to foundation", () => {
    assert.equal(defaultStageForPath("/home"), "foundation");
    assert.equal(defaultStageForPath("/decisions"), "foundation");
  });

  it("Map default landing is plant canvas", () => {
    assert.equal(STAGE_DEFAULT_ROUTES.map, "/god-mode");
    assert.equal(STAGE_DEFAULT_ROUTES.foundation, "/foundation");
  });

  it("filters nav by room", () => {
    assert.equal(isNavIdInStage("foundation", "foundation"), true);
    assert.equal(isNavIdInStage("foundation", "map"), false);
    assert.equal(isNavIdInStage("god-mode", "map"), true);
    assert.equal(isNavIdInStage("workshop", "map"), true);
    assert.equal(isNavIdInStage("workshop", "foundation"), false);
    assert.equal(isNavIdInStage("metrics", "map"), false);
    assert.equal(isNavIdInStage("content", "monitor"), true);
    assert.equal(isNavIdInStage("content", "automate"), true);
    assert.equal(isNavIdInStage("automations", "automate"), true);
    assert.equal(isNavIdInStage("automation-analysis", "automate"), true);
    assert.equal(isNavIdInStage("automation-analysis", "map"), false);
    assert.equal(isNavIdInStage("documents", "monitor"), false);
    assert.equal(isNavIdInStage("documents", "foundation"), true);
    // log/decisions are holistic footer items, not room-scoped
    assert.equal(isNavIdInStage("decisions", "map"), false);
    assert.equal(isNavIdInStage("log", "monitor"), false);
    assert.deepEqual([...HOLISTIC_NAV_IDS], ["decisions", "log"]);
  });

  it("pathBelongsToStage for content, home, documents", () => {
    assert.equal(pathBelongsToStage("/content", "monitor"), true);
    assert.equal(pathBelongsToStage("/content", "automate"), true);
    assert.equal(pathBelongsToStage("/content", "map"), false);
    assert.equal(pathBelongsToStage("/home", "map"), true);
    assert.equal(pathBelongsToStage("/workshop", "map"), true);
    assert.equal(pathBelongsToStage("/workshop", "automate"), false);
    assert.equal(pathBelongsToStage("/foundation", "foundation"), true);
    assert.equal(pathBelongsToStage("/foundation", "map"), false);
    assert.equal(pathBelongsToStage("/god-mode", "map"), true);
    assert.equal(pathBelongsToStage("/documents", "foundation"), true);
    assert.equal(pathBelongsToStage("/documents", "map"), true);
    assert.equal(pathBelongsToStage("/decisions", "map"), true);
    assert.equal(pathBelongsToStage("/decisions", "monitor"), true);
    assert.equal(pathBelongsToStage("/decisions", "automate"), true);
  });
});
