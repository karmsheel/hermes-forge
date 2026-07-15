import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProcessMd,
  buildProcessMdFromBusiness,
  processMdPromptAddon,
} from "../../lib/process-md.ts";

describe("buildProcessMd", () => {
  it("includes core contract sections", () => {
    const md = buildProcessMd({
      businessName: "Acme Ops",
      description: "Regional wholesale",
      industry: "Distribution",
      processes: [
        {
          name: "Order fulfillment",
          department: "Operations",
          status: "mapping",
          trigger: "New paid order",
        },
      ],
      actors: [{ name: "Jordan", role: "Owner", kind: "human" }],
      systems: ["Shopify", "Slack"],
    });

    assert.match(md, /# PROCESS\.md — Acme Ops/);
    assert.match(md, /## Overview/);
    assert.match(md, /## Notation/);
    assert.match(md, /## I\/O shapes/);
    assert.match(md, /## Actors/);
    assert.match(md, /Jordan/);
    assert.match(md, /## Systems/);
    assert.match(md, /Shopify/);
    assert.match(md, /## Processes/);
    assert.match(md, /Order fulfillment/);
    assert.match(md, /I\/O shape/);
    assert.match(md, /## Plant links/);
    assert.match(md, /## Anti-patterns/);
    assert.match(md, /## Export format/);
  });

  it("handles empty process list", () => {
    const md = buildProcessMd({
      businessName: "Empty Co",
      processes: [],
    });
    assert.match(md, /No processes mapped yet/);
  });
});

describe("buildProcessMdFromBusiness", () => {
  it("maps personnel into actors", () => {
    const md = buildProcessMdFromBusiness({
      name: "Forge Demo",
      processes: [],
      humanPersonnel: [{ name: "Alex", role: "Owner" }],
      hermesAgentProfiles: [
        { displayName: "Ops Bot", description: "Scheduler", isHired: true },
        { displayName: "Idle", isHired: false },
      ],
    });
    assert.match(md, /Alex/);
    assert.match(md, /Ops Bot/);
    assert.doesNotMatch(md, /Idle/);
  });
});

describe("processMdPromptAddon", () => {
  it("wraps markdown for agent prompts", () => {
    const addon = processMdPromptAddon("# PROCESS.md — X\n\nHello");
    assert.match(addon, /Business PROCESS\.md contract/);
    assert.match(addon, /Hello/);
  });

  it("truncates long contracts", () => {
    const long = "x".repeat(5000);
    const addon = processMdPromptAddon(long, 100);
    assert.ok(addon.length < 500);
    assert.match(addon, /truncated/);
  });
});
