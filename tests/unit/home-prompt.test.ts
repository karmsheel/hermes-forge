import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveBusinessName } from "../../lib/home-prompt.ts";

describe("deriveBusinessName", () => {
  it("returns Untitled Business for empty brief", () => {
    assert.equal(deriveBusinessName(""), "Untitled Business");
    assert.equal(deriveBusinessName("   "), "Untitled Business");
  });

  it("uses the first line of a multi-line brief", () => {
    assert.equal(
      deriveBusinessName("Acme Ops\nMore detail later"),
      "Acme Ops",
    );
  });

  it("truncates very long single-line briefs", () => {
    const long = "A".repeat(80);
    const name = deriveBusinessName(long);
    assert.ok(name.length <= 60);
    assert.ok(name.endsWith("…"));
  });
});
