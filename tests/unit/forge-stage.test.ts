import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultStageForPath,
  HOLISTIC_NAV_IDS,
  isForgeStage,
  isNavIdInStage,
  pathBelongsToStage,
  stageFromPath,
} from "../../lib/forge-stage.ts";

describe("forge-stage", () => {
  it("recognizes stage ids", () => {
    assert.equal(isForgeStage("map"), true);
    assert.equal(isForgeStage("monitor"), true);
    assert.equal(isForgeStage("automate"), true);
    assert.equal(isForgeStage("run"), false);
  });

  it("infers stage from paths", () => {
    assert.equal(stageFromPath("/workshop"), "map");
    assert.equal(stageFromPath("/functions"), "map");
    assert.equal(stageFromPath("/documents"), "map");
    assert.equal(stageFromPath("/metrics"), "monitor");
    assert.equal(stageFromPath("/cronalytics"), "monitor");
    assert.equal(stageFromPath("/automations/abc"), "automate");
    assert.equal(stageFromPath("/content"), null);
    assert.equal(stageFromPath("/home"), null);
    assert.equal(stageFromPath("/decisions"), null);
  });

  it("defaults neutral paths to map", () => {
    assert.equal(defaultStageForPath("/home"), "map");
    assert.equal(defaultStageForPath("/decisions"), "map");
  });

  it("filters nav by stage", () => {
    assert.equal(isNavIdInStage("workshop", "map"), true);
    assert.equal(isNavIdInStage("metrics", "map"), false);
    assert.equal(isNavIdInStage("content", "monitor"), true);
    assert.equal(isNavIdInStage("content", "automate"), true);
    assert.equal(isNavIdInStage("automations", "automate"), true);
    assert.equal(isNavIdInStage("documents", "monitor"), false);
    // log/decisions are holistic footer items, not stage-scoped
    assert.equal(isNavIdInStage("decisions", "map"), false);
    assert.equal(isNavIdInStage("log", "monitor"), false);
    assert.deepEqual([...HOLISTIC_NAV_IDS], ["log", "decisions"]);
  });

  it("pathBelongsToStage for content and home", () => {
    assert.equal(pathBelongsToStage("/content", "monitor"), true);
    assert.equal(pathBelongsToStage("/content", "automate"), true);
    assert.equal(pathBelongsToStage("/content", "map"), false);
    assert.equal(pathBelongsToStage("/home", "map"), true);
    assert.equal(pathBelongsToStage("/workshop", "map"), true);
    assert.equal(pathBelongsToStage("/workshop", "automate"), false);
    assert.equal(pathBelongsToStage("/decisions", "map"), true);
    assert.equal(pathBelongsToStage("/decisions", "monitor"), true);
    assert.equal(pathBelongsToStage("/decisions", "automate"), true);
  });
});
