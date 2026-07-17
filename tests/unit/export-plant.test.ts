import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlantSvg, exportPlantSvg } from "../../lib/export-plant.ts";

const sampleBlocks = [
  {
    id: "p1",
    name: "Lead intake",
    department: "Sales",
    status: "draft",
    ioShape: "siso",
    x: 64,
    y: 100,
    width: 176,
    height: 168,
  },
  {
    id: "p2",
    name: "Fulfillment",
    department: "Ops",
    status: "forged",
    ioShape: "mimo",
    x: 300,
    y: 100,
    width: 176,
    height: 168,
  },
];

const sampleLinks = [{ fromId: "p1", toId: "p2" }];

describe("buildPlantSvg", () => {
  it("produces a self-contained SVG with title, blocks, and links", () => {
    const svg = buildPlantSvg({
      title: "Acme — Plant",
      blocks: sampleBlocks,
      links: sampleLinks,
      canvasWidth: 800,
      canvasHeight: 600,
      layoutMode: "function",
      appearance: "print",
    });

    assert.match(svg, /^<svg\b/);
    assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /Acme — Plant/);
    assert.match(svg, /Lead intake/);
    assert.match(svg, /Fulfillment/);
    assert.match(svg, /SALES/);
    assert.match(svg, /OPS/);
    assert.match(svg, /plant-export-arrow/);
    assert.match(svg, /data-process-id="p1"/);
    assert.match(svg, /data-process-id="p2"/);
    // Orthogonal path present
    assert.match(svg, /<path d="M/);
  });

  it("escapes XML in process names", () => {
    const svg = buildPlantSvg({
      title: "T",
      blocks: [
        {
          ...sampleBlocks[0],
          name: 'A & B <script>"x"',
        },
      ],
      links: [],
      canvasWidth: 400,
      canvasHeight: 300,
      appearance: "print",
    });
    assert.doesNotMatch(svg, /<script>/);
    assert.match(svg, /A &amp; B &lt;script&gt;/);
  });

  it("omits department labels outside function layout", () => {
    const svg = buildPlantSvg({
      title: "Flow plant",
      blocks: sampleBlocks,
      links: sampleLinks,
      canvasWidth: 800,
      canvasHeight: 600,
      layoutMode: "flow",
      appearance: "print",
    });
    assert.doesNotMatch(svg, />SALES</);
  });
});

describe("exportPlantSvg", () => {
  it("returns a downloadable SVG blob and slug filename", () => {
    const result = exportPlantSvg({
      businessName: "Acme Co",
      blocks: sampleBlocks,
      links: sampleLinks,
      canvasWidth: 800,
      canvasHeight: 600,
      layoutMode: "function",
    });
    assert.equal(result.filename, "acme-co-plant.svg");
    assert.equal(result.blob.type, "image/svg+xml;charset=utf-8");
  });

  it("throws when there are no blocks", () => {
    assert.throws(
      () =>
        exportPlantSvg({
          businessName: "Empty",
          blocks: [],
          links: [],
          canvasWidth: 800,
          canvasHeight: 600,
        }),
      /No processes/,
    );
  });
});
