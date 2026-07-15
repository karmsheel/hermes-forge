import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateFunctions,
  detectFunctionSuggestions,
  normalizeDepartment,
} from "../../lib/functions.ts";

describe("normalizeDepartment", () => {
  it("trims and defaults empty to Uncategorized", () => {
    assert.equal(normalizeDepartment("  Sales "), "Sales");
    assert.equal(normalizeDepartment(""), "Uncategorized");
    assert.equal(normalizeDepartment(null), "Uncategorized");
  });
});

describe("aggregateFunctions", () => {
  it("counts processes by department", () => {
    const result = aggregateFunctions([
      { department: "Sales" } as never,
      { department: "Sales" } as never,
      { department: "Ops" } as never,
    ]);
    assert.deepEqual(result, [
      { name: "Sales", count: 2 },
      { name: "Ops", count: 1 },
    ]);
  });

  it("includes declared empty functions", () => {
    const result = aggregateFunctions(
      [{ department: "Sales" } as never],
      [{ name: "Marketing" }, { name: "Sales" }],
    );
    assert.equal(result.find((f) => f.name === "Marketing")?.count, 0);
    assert.equal(result.find((f) => f.name === "Sales")?.count, 1);
  });
});

describe("detectFunctionSuggestions", () => {
  it("scores industry keywords and skips existing", () => {
    const names = detectFunctionSuggestions({
      industry: "B2B SaaS marketing software",
      description: "We help with content and growth",
      goals: null,
      existing: ["Sales"],
    });
    assert.ok(names.includes("Marketing"));
    assert.ok(!names.includes("Sales"));
  });
});
