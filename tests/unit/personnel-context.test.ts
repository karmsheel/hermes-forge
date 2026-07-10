import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPersonnelRoster,
  formatPersonnelPromptContext,
  formatSwimlanePersonnelAddon,
  personnelToMentionables,
} from "../../lib/personnel/context.ts";

describe("buildPersonnelRoster", () => {
  it("maps humans and hired agents; skips unhired agents", () => {
    const roster = buildPersonnelRoster({
      humans: [
        {
          id: "h1",
          name: "Alex Chen",
          role: "Owner",
          roleDescription: "Runs the shop",
          isOwner: true,
        },
      ],
      agents: [
        { id: "a1", displayName: "Ops Bot", description: "Scheduler", isHired: true },
        { id: "a2", displayName: "Idle Bot", isHired: false },
      ],
    });

    assert.equal(roster.humans.length, 1);
    assert.equal(roster.agents.length, 1);
    assert.equal(roster.agents[0].name, "Ops Bot");
    assert.ok(roster.departments.includes("Owner"));
  });
});

describe("formatPersonnelPromptContext", () => {
  it("returns empty for empty roster", () => {
    assert.equal(
      formatPersonnelPromptContext(buildPersonnelRoster({ humans: [], agents: [] })),
      "",
    );
  });

  it("lists people and roles for agents", () => {
    const roster = buildPersonnelRoster({
      humans: [{ id: "h1", name: "Jordan", role: "Ops", isOwner: true }],
      agents: [{ id: "a1", displayName: "Cron Agent", description: "Runs jobs", isHired: true }],
    });
    const text = formatPersonnelPromptContext(roster);
    assert.match(text, /Jordan/);
    assert.match(text, /\[owner\]/);
    assert.match(text, /Cron Agent/);
    assert.match(text, /Functions \/ roles/);
  });
});

describe("formatSwimlanePersonnelAddon", () => {
  it("names roster lanes", () => {
    const roster = buildPersonnelRoster({
      humans: [{ id: "h1", name: "Sam", role: "Sales" }],
      agents: [],
    });
    const text = formatSwimlanePersonnelAddon(roster);
    assert.match(text, /Sam/);
    assert.match(text, /subgraph/i);
  });
});

describe("personnelToMentionables", () => {
  it("emits actor and department kinds", () => {
    const roster = buildPersonnelRoster({
      humans: [{ id: "h1", name: "Alex Chen", role: "Operations Manager" }],
      agents: [{ id: "a1", displayName: "Ops Bot", isHired: true }],
    });
    const mentions = personnelToMentionables(roster);
    assert.ok(mentions.some((m) => m.kind === "actor" && m.label === "Alex Chen"));
    assert.ok(mentions.some((m) => m.kind === "actor" && m.label === "Ops Bot"));
    assert.ok(mentions.some((m) => m.kind === "department" && m.label === "Operations Manager"));
  });
});
