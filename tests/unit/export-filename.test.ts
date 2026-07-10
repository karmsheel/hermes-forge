import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugifyFilename } from "../../lib/export-diagram.ts";

describe("slugifyFilename", () => {
  it("slugifies process names for downloads", () => {
    assert.equal(slugifyFilename("Order Fulfillment"), "order-fulfillment");
    assert.equal(slugifyFilename("  Hello!! World  "), "hello-world");
  });

  it("falls back for empty names", () => {
    assert.equal(slugifyFilename(""), "process");
    assert.equal(slugifyFilename("@@@"), "process");
  });
});
