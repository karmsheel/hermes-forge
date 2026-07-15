import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boundaryCountsFromMermaid,
  countBoundaryItems,
  deriveIoShape,
  isIoShapeId,
  ioShapePromptAddon,
  normalizeIoShape,
  shapeFromCounts,
} from "../../lib/io-shape.ts";

describe("countBoundaryItems", () => {
  it("returns 0 for empty", () => {
    assert.equal(countBoundaryItems(null), 0);
    assert.equal(countBoundaryItems(""), 0);
    assert.equal(countBoundaryItems("  "), 0);
  });

  it("splits on plus, commas, and newlines", () => {
    assert.equal(countBoundaryItems("Stripe webhook + customer email"), 2);
    assert.equal(countBoundaryItems("A, B, C"), 3);
    assert.equal(countBoundaryItems("Lead form\nCRM record"), 2);
  });

  it("dedupes case-insensitively", () => {
    assert.equal(countBoundaryItems("Email\nemail\nEMAIL"), 1);
  });
});

describe("shapeFromCounts", () => {
  it("maps cardinality to library ids", () => {
    assert.equal(shapeFromCounts(1, 1), "siso");
    assert.equal(shapeFromCounts(1, 3), "simo");
    assert.equal(shapeFromCounts(2, 1), "miso");
    assert.equal(shapeFromCounts(2, 2), "mimo");
  });
});

describe("deriveIoShape", () => {
  it("defaults to siso", () => {
    assert.equal(deriveIoShape({}), "siso");
  });

  it("uses free-text inputs/outputs first", () => {
    assert.equal(
      deriveIoShape({
        inputs: "Webhook",
        outputs: "Email + Slack + CRM",
      }),
      "simo"
    );
    assert.equal(
      deriveIoShape({
        inputs: "Form\nAPI\nManual upload",
        outputs: "Ticket",
      }),
      "miso"
    );
  });

  it("honors explicit shape", () => {
    assert.equal(
      deriveIoShape({
        inputs: "A + B",
        outputs: "C + D",
        explicit: "siso",
      }),
      "siso"
    );
  });

  it("falls back to Mermaid boundary counts", () => {
    const mermaid = `
flowchart TD
  start([New order]) --> pack[Pack]
  pack --> ship([Shipped])
  pack --> invoice([Invoice sent])
`;
    assert.equal(deriveIoShape({ diagramMermaid: mermaid }), "simo");
  });

  it("keeps merge-back diagrams as siso when one source and one sink", () => {
    const mermaid = `
flowchart TD
  start([Trigger]) --> d{Branch?}
  d -->|yes| a[Path A]
  d -->|no| b[Path B]
  a --> endn([Done])
  b --> endn
`;
    assert.equal(deriveIoShape({ diagramMermaid: mermaid }), "siso");
  });
});

describe("boundaryCountsFromMermaid", () => {
  it("returns null for empty or tiny graphs", () => {
    assert.equal(boundaryCountsFromMermaid(null), null);
    assert.equal(boundaryCountsFromMermaid("flowchart TD\n  a[Only]"), null);
  });
});

describe("normalize / isIoShapeId", () => {
  it("validates ids", () => {
    assert.equal(isIoShapeId("mimo"), true);
    assert.equal(isIoShapeId("nope"), false);
    assert.equal(normalizeIoShape("bogus"), "siso");
  });
});

describe("ioShapePromptAddon", () => {
  it("includes catalog and current shape", () => {
    const text = ioShapePromptAddon("miso");
    assert.match(text, /miso/);
    assert.match(text, /siso/);
    assert.match(text, /black-box/i);
  });
});
