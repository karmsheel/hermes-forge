import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectPlantToFlow } from "../../lib/plant-flow-project.ts";
import type { ProcessLinkDto } from "../../lib/process-links.ts";

const links: ProcessLinkDto[] = [
  {
    id: "l1",
    businessId: "b1",
    fromProcessId: "p1",
    toProcessId: "p2",
    label: "handoff",
    fromPort: null,
    toPort: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("projectPlantToFlow", () => {
  it("projects processes to forgeProcess nodes and edges", () => {
    const { nodes, edges } = projectPlantToFlow(
      [
        {
          id: "p1",
          name: "Capture leads",
          department: "Marketing",
          status: "draft",
          ioShape: "siso",
        },
        {
          id: "p2",
          name: "Qualify",
          department: "Sales",
          status: "forged",
          ioShape: "miso",
        },
      ],
      links,
      { layoutMode: "function" },
    );

    assert.equal(nodes.length, 2);
    assert.equal(nodes[0]!.type, "forgeProcess");
    assert.equal(nodes[0]!.data.processId, "p1");
    assert.equal(nodes[1]!.data.ioShape, "miso");
    assert.equal(edges.length, 1);
    assert.equal(edges[0]!.source, "p1");
    assert.equal(edges[0]!.target, "p2");
  });

  it("uses manual positions when provided", () => {
    const { nodes } = projectPlantToFlow(
      [
        { id: "p1", name: "A", department: "Ops", ioShape: "siso" },
        { id: "p2", name: "B", department: "Ops", ioShape: "simo" },
      ],
      [],
      {
        layoutMode: "manual",
        positions: { p1: { x: 10, y: 20 }, p2: { x: 100, y: 200 } },
      },
    );

    const a = nodes.find((n) => n.id === "p1");
    const b = nodes.find((n) => n.id === "p2");
    assert.deepEqual(a?.position, { x: 10, y: 20 });
    assert.deepEqual(b?.position, { x: 100, y: 200 });
  });

  it("skips edges when endpoint missing", () => {
    const { edges } = projectPlantToFlow(
      [{ id: "p1", name: "Only", department: "Ops" }],
      links,
    );
    assert.equal(edges.length, 0);
  });
});
