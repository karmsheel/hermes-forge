import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyGraphPatch,
  emptyBusinessGraph,
  parseBusinessGraph,
  projectFoundationGraph,
  projectProcessStepGraph,
  seedGraphFromLegacy,
  serializeBusinessGraph,
} from "../../lib/business-graph/index.ts";

describe("business-graph", () => {
  it("parse empty / invalid → empty graph", () => {
    assert.equal(parseBusinessGraph(null).nodes.length, 0);
    assert.equal(parseBusinessGraph("{").nodes.length, 0);
  });

  it("round-trips serialize/parse", () => {
    const g = emptyBusinessGraph();
    g.nodes.push({
      id: "u1",
      kind: "unit",
      name: "Marketing",
      parentId: null,
    });
    const raw = serializeBusinessGraph(g);
    const back = parseBusinessGraph(raw);
    assert.equal(back.nodes.length, 1);
    assert.equal(back.nodes[0]!.name, "Marketing");
  });

  it("applyGraphPatch upserts and positions", () => {
    let g = emptyBusinessGraph();
    const r1 = applyGraphPatch(g, {
      ops: [
        {
          op: "upsert_node",
          node: { id: "u1", kind: "unit", name: "Sales", parentId: null },
        },
        {
          op: "upsert_node",
          node: {
            id: "c1",
            kind: "capability",
            name: "Outbound",
            parentId: "u1",
          },
        },
        {
          op: "upsert_edge",
          edge: {
            id: "e1",
            kind: "contains",
            fromId: "u1",
            toId: "c1",
          },
        },
      ],
    });
    assert.equal(r1.applied, 3);
    assert.equal(r1.graph.nodes.length, 2);
    assert.equal(r1.graph.edges.length, 1);

    const r2 = applyGraphPatch(r1.graph, {
      ops: [{ op: "set_position", id: "u1", position: { x: 10, y: 20 } }],
    });
    assert.deepEqual(r2.graph.nodes.find((n) => n.id === "u1")?.position, {
      x: 10,
      y: 20,
    });
  });

  it("seedGraphFromLegacy builds unit/capability/process tree", () => {
    const g = seedGraphFromLegacy({
      businessId: "b1",
      businessName: "Acme",
      functions: [{ id: "f1", name: "Marketing" }],
      processes: [
        {
          id: "p1",
          name: "Lead gen",
          department: "Marketing",
          status: "draft",
        },
      ],
      processLinks: [],
    });
    assert.ok(g.nodes.some((n) => n.kind === "business"));
    assert.ok(g.nodes.some((n) => n.kind === "unit" && n.name === "Marketing"));
    assert.ok(g.nodes.some((n) => n.kind === "capability"));
    assert.ok(g.nodes.some((n) => n.kind === "process" && n.id === "p1"));
  });

  it("projectFoundationGraph returns xyflow nodes with processCount", () => {
    const g = seedGraphFromLegacy({
      businessId: "b1",
      businessName: "Acme",
      functions: [{ id: "f1", name: "Ops" }],
      processes: [{ id: "p1", name: "Fulfill", department: "Ops" }],
    });
    const { nodes, edges } = projectFoundationGraph(g);
    assert.ok(nodes.length >= 2);
    assert.ok(nodes.every((n) => n.type === "graphNode"));
    assert.ok(edges.length >= 1);
    const unit = nodes.find((n) => n.data.kind === "unit");
    assert.ok(unit);
    assert.equal(unit!.data.processCount, 1);
    const cap = nodes.find((n) => n.data.kind === "capability");
    assert.ok(cap);
    assert.equal(cap!.data.processCount, 1);
  });

  it("projectProcessStepGraph and step patch ops", () => {
    let g = seedGraphFromLegacy({
      businessId: "b1",
      businessName: "Acme",
      functions: [{ id: "f1", name: "Ops" }],
      processes: [{ id: "p1", name: "Fulfill", department: "Ops" }],
    });
    const r = applyGraphPatch(g, {
      ops: [
        {
          op: "upsert_node",
          node: {
            id: "s1",
            kind: "step",
            name: "Receive",
            parentId: "p1",
            position: { x: 10, y: 20 },
          },
        },
        {
          op: "upsert_node",
          node: {
            id: "s2",
            kind: "step",
            name: "Ship",
            parentId: "p1",
          },
        },
        {
          op: "upsert_edge",
          edge: {
            id: "contains_p1_s1",
            kind: "contains",
            fromId: "p1",
            toId: "s1",
          },
        },
        {
          op: "upsert_edge",
          edge: {
            id: "contains_p1_s2",
            kind: "contains",
            fromId: "p1",
            toId: "s2",
          },
        },
        {
          op: "upsert_edge",
          edge: {
            id: "flow_s1_s2",
            kind: "flows_to",
            fromId: "s1",
            toId: "s2",
          },
        },
      ],
    });
    assert.equal(r.applied, 5);
    g = r.graph;
    const projected = projectProcessStepGraph(g, "p1");
    assert.ok(projected.nodes.some((n) => n.data.kind === "process"));
    assert.equal(
      projected.nodes.filter((n) => n.data.kind === "step").length,
      2,
    );
    assert.ok(projected.edges.some((e) => e.id === "flow_s1_s2"));

    const del = applyGraphPatch(g, {
      ops: [{ op: "delete_node", id: "s1" }],
    });
    assert.equal(
      del.graph.nodes.filter((n) => n.kind === "step").length,
      1,
    );
    assert.ok(!del.graph.edges.some((e) => e.id === "flow_s1_s2"));
  });
});
