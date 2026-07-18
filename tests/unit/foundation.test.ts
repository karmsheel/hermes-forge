import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  foundationStudioPromptAddon,
  isThinBusiness,
  normalizeSeedDrafts,
  toFoundationProcessCard,
} from "../../lib/foundation.ts";

describe("isThinBusiness", () => {
  it("treats empty and early unforged maps as thin", () => {
    assert.equal(isThinBusiness({ processCount: 0 }), true);
    assert.equal(isThinBusiness({ processCount: 2, forgedCount: 0 }), true);
    assert.equal(isThinBusiness({ processCount: 5, forgedCount: 0 }), false);
    assert.equal(isThinBusiness({ processCount: 2, forgedCount: 1 }), false);
  });
});

describe("normalizeSeedDrafts", () => {
  it("trims, dedupes, and drops empty names", () => {
    const out = normalizeSeedDrafts([
      { name: "  Order intake  " },
      { name: "order intake" },
      { name: "" },
      { name: "Fulfillment", description: "Ship goods", ioShape: "simo" },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].name, "Order intake");
    assert.equal(out[1].name, "Fulfillment");
    assert.equal(out[1].ioShape, "simo");
  });

  it("preserves starter diagramMermaid for template seeds (6.7)", () => {
    const out = normalizeSeedDrafts([
      {
        name: "SOP",
        diagramMermaid: "flowchart TD\n  a-->b",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].diagramMermaid, "flowchart TD\n  a-->b");
  });
});

describe("toFoundationProcessCard", () => {
  it("maps prisma-like rows", () => {
    const card = toFoundationProcessCard({
      id: "p1",
      name: "Demo",
      description: "x",
      department: "Ops",
      status: "draft",
      ioShape: "mimo",
      diagramMermaid: "flowchart TD\n  a-->b",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.equal(card.ioShape, "mimo");
    assert.equal(card.hasDiagram, true);
    assert.equal(card.department, "Ops");
  });
});

describe("foundationStudioPromptAddon", () => {
  it("mentions Overlord, plant sketch, and shapes", () => {
    const text = foundationStudioPromptAddon();
    assert.match(text, /Overlord/);
    assert.match(text, /Foundation/i);
    assert.match(text, /siso/);
    assert.match(text, /Workshop/);
  });
});
