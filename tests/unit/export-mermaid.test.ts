import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emptyBusinessGraph,
  exportProcessStepsToMermaid,
  type BusinessGraph,
} from "../../lib/business-graph/index.ts";

function sampleGraph(): BusinessGraph {
  return {
    version: 1,
    nodes: [
      { id: "biz", kind: "business", name: "Acme", parentId: null },
      { id: "u1", kind: "unit", name: "Ops", parentId: "biz" },
      { id: "c1", kind: "capability", name: "Fulfillment", parentId: "u1" },
      { id: "p1", kind: "process", name: "Ship order", parentId: "c1" },
      {
        id: "step_a",
        kind: "step",
        name: "Pick items",
        parentId: "p1",
        position: { x: 0, y: 0 },
      },
      {
        id: "step_b",
        kind: "step",
        name: "Pack box",
        parentId: "p1",
        position: { x: 0, y: 100 },
      },
      {
        id: "step_c",
        kind: "step",
        name: "Hand off",
        parentId: "p1",
        position: { x: 0, y: 200 },
      },
    ],
    edges: [
      {
        id: "e1",
        kind: "flows_to",
        fromId: "step_a",
        toId: "step_b",
      },
      {
        id: "e2",
        kind: "flows_to",
        fromId: "step_b",
        toId: "step_c",
        label: "ready",
      },
    ],
  };
}

describe("exportProcessStepsToMermaid", () => {
  it("returns null when process is missing", () => {
    assert.equal(exportProcessStepsToMermaid(emptyBusinessGraph(), "nope"), null);
  });

  it("exports flowchart with nodes and flows_to edges", () => {
    const out = exportProcessStepsToMermaid(sampleGraph(), "p1");
    assert.ok(out);
    assert.match(out!, /^%% /m);
    assert.match(out!, /flowchart TD/);
    assert.match(out!, /Pick items/);
    assert.match(out!, /Pack box/);
    assert.match(out!, /Hand off/);
    assert.match(out!, /-->/);
    assert.match(out!, /ready/);
  });

  it("exports empty-step placeholder", () => {
    const g: BusinessGraph = {
      version: 1,
      nodes: [
        { id: "p1", kind: "process", name: "Empty", parentId: null },
      ],
      edges: [],
    };
    const out = exportProcessStepsToMermaid(g, "p1");
    assert.ok(out);
    assert.match(out!, /No steps yet/);
  });

  it("chains by position when no edges", () => {
    const g: BusinessGraph = {
      version: 1,
      nodes: [
        { id: "p1", kind: "process", name: "Seq", parentId: null },
        {
          id: "s1",
          kind: "step",
          name: "One",
          parentId: "p1",
          position: { x: 0, y: 0 },
        },
        {
          id: "s2",
          kind: "step",
          name: "Two",
          parentId: "p1",
          position: { x: 0, y: 40 },
        },
      ],
      edges: [],
    };
    const out = exportProcessStepsToMermaid(g, "p1")!;
    assert.match(out, /One/);
    assert.match(out, /Two/);
    assert.match(out, /-->/);
  });

  it("sanitizes special characters in labels", () => {
    const g: BusinessGraph = {
      version: 1,
      nodes: [
        { id: "p1", kind: "process", name: "P", parentId: null },
        {
          id: "s1",
          kind: "step",
          name: 'Say "hi" [now]',
          parentId: "p1",
        },
      ],
      edges: [],
    };
    const out = exportProcessStepsToMermaid(g, "p1")!;
    assert.doesNotMatch(out, /\[now\]/);
    assert.match(out, /Say/);
  });
});
