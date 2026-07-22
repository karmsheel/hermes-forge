import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPromptPack,
  listPromptCatalog,
  PROMPT_PACK_IDS,
  isPromptPackId,
} from "../../lib/chatbar/prompt-catalog.ts";

describe("prompt catalog", () => {
  it("includes chatbar packs for studio, foundation, workshop, automation", () => {
    const ids = listPromptCatalog().map((p) => p.id);
    for (const id of [
      "studio-default",
      "foundation",
      "workshop-process",
      "automation-architect",
    ] as const) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
  });

  it("lists background packs separately", () => {
    const bg = listPromptCatalog().filter((p) => p.surface === "background");
    assert.ok(bg.some((p) => p.id === "diagram-subagent"));
    assert.ok(bg.some((p) => p.id === "automation-extract"));
  });

  it("lists job packs", () => {
    const jobs = listPromptCatalog().filter((p) => p.surface === "job");
    assert.ok(jobs.some((p) => p.id === "automation-deploy"));
  });

  it("PROMPT_PACK_IDS matches catalog length", () => {
    assert.equal(listPromptCatalog().length, PROMPT_PACK_IDS.length);
  });

  it("isPromptPackId accepts known ids only", () => {
    assert.equal(isPromptPackId("studio-default"), true);
    assert.equal(isPromptPackId("not-a-pack"), false);
  });

  it("buildPromptPack studio-default mentions Forge and business name", () => {
    const { system } = buildPromptPack("studio-default", {
      businessName: "Acme",
      route: "/home",
      mode: "follow-page",
      agent: null,
    });
    assert.match(system, /Acme/);
    assert.match(system, /Hermes Forge/i);
  });

  it("buildPromptPack foundation includes Overlord plant guidance", () => {
    const { system } = buildPromptPack("foundation", {
      businessName: "Acme",
      route: "/foundation",
      mode: "follow-page",
      agent: null,
    });
    assert.match(system, /Foundation|Overlord|forge-drafts/i);
  });

  it("buildPromptPack workshop-process uses process analyst framing", () => {
    const { system } = buildPromptPack("workshop-process", {
      businessName: "Acme",
      route: "/workshop",
      processName: "Order flow",
      mode: "follow-page",
    });
    assert.match(system, /Business Process Analyst|process/i);
    assert.match(system, /Order flow|ONE specific business process/i);
  });

  it("buildPromptPack diagram-subagent returns mermaid diagrammer role", () => {
    const { system } = buildPromptPack("diagram-subagent", {
      businessName: "Acme",
      route: "/workshop",
    });
    assert.match(system, /diagrammer|Mermaid/i);
  });

  it("buildPromptPack automation-architect mentions Automation Architect", () => {
    const { system } = buildPromptPack("automation-architect", {
      businessName: "Acme",
      route: "/automations/x",
      processName: "Order flow",
    });
    assert.match(system, /Automation Architect/i);
  });
});
