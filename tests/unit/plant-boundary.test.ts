import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  derivePlantBoundary,
  layoutPlantBoundaryFraming,
} from "../../lib/plant-boundary.ts";
import { listBoundaryItems } from "../../lib/io-shape.ts";

describe("listBoundaryItems", () => {
  it("splits and dedupes free-text I/O", () => {
    assert.deepEqual(listBoundaryItems("Leads\nReferrals, Leads"), [
      "Leads",
      "Referrals",
    ]);
  });
});

describe("derivePlantBoundary", () => {
  const processes = [
    {
      id: "a",
      name: "Intake",
      inputs: "Inbound leads\nReferrals",
      outputs: "Qualified opps",
    },
    {
      id: "b",
      name: "Fulfill",
      inputs: "Orders",
      outputs: "Delivered goods\nInvoices",
    },
    {
      id: "c",
      name: "Support",
      inputs: "Tickets",
      outputs: "Resolved tickets",
    },
  ];

  it("uses entry process inputs as feeds and exit process outputs as products", () => {
    const links = [
      { fromId: "a", toId: "b" },
      { fromId: "b", toId: "c" },
    ];
    const result = derivePlantBoundary(processes, links);

    assert.deepEqual(result.entryProcessIds, ["a"]);
    assert.deepEqual(result.exitProcessIds, ["c"]);
    assert.equal(result.feeds.length, 2);
    assert.equal(result.feeds[0].label, "Inbound leads");
    assert.equal(result.feeds[0].processId, "a");
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0].label, "Resolved tickets");
    assert.equal(result.products[0].processId, "c");
  });

  it("treats unlinked processes as both entry and exit", () => {
    const result = derivePlantBoundary(
      [
        {
          id: "solo",
          name: "Solo",
          inputs: "Raw material",
          outputs: "Finished good",
        },
      ],
      [],
    );
    assert.deepEqual(result.entryProcessIds, ["solo"]);
    assert.deepEqual(result.exitProcessIds, ["solo"]);
    assert.equal(result.feeds[0].label, "Raw material");
    assert.equal(result.products[0].label, "Finished good");
  });

  it("skips processes with empty I/O text", () => {
    const result = derivePlantBoundary(
      [{ id: "x", name: "Empty", inputs: null, outputs: "  " }],
      [],
    );
    assert.equal(result.feeds.length, 0);
    assert.equal(result.products.length, 0);
  });
});

describe("layoutPlantBoundaryFraming", () => {
  it("places feeds left and products right and expands canvas", () => {
    const layout = layoutPlantBoundaryFraming({
      tiles: [
        {
          id: "a",
          department: "Sales",
          x: 64,
          y: 100,
          width: 176,
          height: 168,
        },
        {
          id: "b",
          department: "Ops",
          x: 320,
          y: 100,
          width: 176,
          height: 168,
        },
      ],
      baseCanvasWidth: 800,
      baseCanvasHeight: 600,
      processes: [
        {
          id: "a",
          name: "Intake",
          inputs: "Leads",
          outputs: null,
        },
        {
          id: "b",
          name: "Ship",
          inputs: null,
          outputs: "Packages",
        },
      ],
      links: [{ fromId: "a", toId: "b" }],
    });

    assert.equal(layout.hasItems, true);
    assert.equal(layout.feeds.length, 1);
    assert.equal(layout.products.length, 1);
    // Feed sits left of entry tile (after offset)
    assert.ok(layout.feeds[0].x < layout.feeds[0].attachX);
    // Product sits right of exit tile
    assert.ok(layout.products[0].x > layout.products[0].attachX);
    // Canvas grows to fit left rail
    assert.ok(layout.tileOffset.x > 0);
    assert.ok(layout.canvasWidth >= 800);
  });

  it("returns base canvas when no outside I/O text", () => {
    const layout = layoutPlantBoundaryFraming({
      tiles: [
        {
          id: "a",
          department: "Sales",
          x: 64,
          y: 100,
          width: 176,
          height: 168,
        },
      ],
      baseCanvasWidth: 800,
      baseCanvasHeight: 600,
      processes: [{ id: "a", name: "A", inputs: null, outputs: null }],
      links: [],
    });
    assert.equal(layout.hasItems, false);
    assert.equal(layout.canvasWidth, 800);
    assert.equal(layout.tileOffset.x, 0);
  });
});
