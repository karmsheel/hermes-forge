import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasPlantApplyFences,
  parseForgeDocsFence,
  parseForgeGraphFence,
  parseForgeLinksFence,
  shouldAutoApplyPlant,
  summarizePlantApply,
  type PlantApplyResult,
} from "../../lib/plant-apply.ts";
import { parseForgeDraftsFence } from "../../lib/foundation-extract.ts";

describe("plant-apply parse + helpers", () => {
  it("detects plant routes for auto-apply", () => {
    assert.equal(shouldAutoApplyPlant("/foundation"), true);
    assert.equal(shouldAutoApplyPlant("/god-mode"), true);
    assert.equal(shouldAutoApplyPlant("/documents"), true);
    assert.equal(shouldAutoApplyPlant("/home"), true);
    assert.equal(shouldAutoApplyPlant("/map/home"), true);
    assert.equal(shouldAutoApplyPlant("/monitor/home"), true);
    assert.equal(shouldAutoApplyPlant("/automate/home"), true);
    assert.equal(shouldAutoApplyPlant("/workshop"), false);
    assert.equal(shouldAutoApplyPlant("/automations"), false);
  });

  it("detects plant fences", () => {
    assert.equal(hasPlantApplyFences("no fences"), false);
    assert.equal(
      hasPlantApplyFences("```forge-drafts\n[]\n```"),
      true
    );
    assert.equal(
      hasPlantApplyFences("```forge-links\n[]\n```"),
      true
    );
    assert.equal(
      hasPlantApplyFences("```forge-docs\n[]\n```"),
      true
    );
    assert.equal(
      hasPlantApplyFences('```forge-graph\n[{"op":"delete_node","id":"x"}]\n```'),
      true
    );
  });

  it("parses forge-graph fence ops", () => {
    const text = `
\`\`\`forge-graph
[
  {"op":"upsert_node","node":{"id":"u1","kind":"unit","name":"Sales","parentId":null}},
  {"op":"upsert_edge","edge":{"id":"e1","kind":"contains","fromId":"u1","toId":"c1"}},
  {"op":"set_position","id":"u1","position":{"x":10,"y":20}}
]
\`\`\`
`;
    const ops = parseForgeGraphFence(text);
    assert.equal(ops.length, 3);
    assert.equal(ops[0]!.op, "upsert_node");
    if (ops[0]!.op === "upsert_node") {
      assert.equal(ops[0]!.node.name, "Sales");
      assert.equal(ops[0]!.node.kind, "unit");
    }
    assert.equal(ops[2]!.op, "set_position");
  });

  it("rejects invalid forge-graph ops", () => {
    const text = `\`\`\`forge-graph
[
  {"op":"upsert_node","node":{"id":"x","kind":"nope","name":"Bad"}},
  {"op":"delete_node","id":"ok"}
]
\`\`\``;
    const ops = parseForgeGraphFence(text);
    assert.equal(ops.length, 1);
    assert.equal(ops[0]!.op, "delete_node");
  });

  it("parses forge-links fence by from/to names", () => {
    const text = `
Here are handoffs:

\`\`\`forge-links
[
  {"from":"Lead gen","to":"Fulfillment","label":"orders"},
  {"fromName":"Fulfillment","toName":"Support"}
]
\`\`\`
`;
    const links = parseForgeLinksFence(text);
    assert.equal(links.length, 2);
    assert.equal(links[0].fromName, "Lead gen");
    assert.equal(links[0].toName, "Fulfillment");
    assert.equal(links[0].label, "orders");
    assert.equal(links[1].fromName, "Fulfillment");
    assert.equal(links[1].toName, "Support");
  });

  it("dedupes forge-links", () => {
    const text = `\`\`\`forge-links
[
  {"from":"A","to":"B"},
  {"from":"a","to":"b"}
]
\`\`\``;
    const links = parseForgeLinksFence(text);
    assert.equal(links.length, 1);
  });

  it("parses forge-docs fence", () => {
    const text = `\`\`\`forge-docs
[{"slug":"basics","bodyMarkdown":"## Purpose\\nWe ship.","mode":"replace"}]
\`\`\``;
    const docs = parseForgeDocsFence(text);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].slug, "basics");
    assert.match(docs[0].bodyMarkdown, /We ship/);
    assert.equal(docs[0].mode, "replace");
  });

  it("parses combined fences with drafts", () => {
    const text = `
\`\`\`forge-drafts
[{"name":"Lead gen","ioShape":"simo"}]
\`\`\`

\`\`\`forge-links
[{"from":"Lead gen","to":"Ops"}]
\`\`\`
`;
    assert.equal(hasPlantApplyFences(text), true);
    const drafts = parseForgeDraftsFence(text);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].name, "Lead gen");
    const links = parseForgeLinksFence(text);
    assert.equal(links.length, 1);
  });

  it("summarizes apply results", () => {
    const result: PlantApplyResult = {
      applied: true,
      drafts: {
        created: [],
        updated: [],
        skipped: [],
        createdCount: 2,
        updatedCount: 1,
        skippedCount: 0,
      },
      documents: [
        {
          id: "1",
          title: "Basics",
          slug: "basics",
          action: "updated",
        },
      ],
      links: {
        created: [],
        skipped: [],
        errors: [],
        createdCount: 1,
      },
      graph: {
        appliedOps: 4,
        opCount: 5,
        errors: [],
      },
      errors: [],
    };
    const summary = summarizePlantApply(result);
    assert.match(summary, /3 draft/);
    assert.match(summary, /document/);
    assert.match(summary, /link/);
    assert.match(summary, /4 graph op/);
  });
});
