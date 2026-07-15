import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildContentIngestUrl,
  generateIngestToken,
  normalizeIngestTitle,
  resolveIngestChannel,
  resolveIngestStatus,
} from "../../lib/content-ingest.ts";

describe("content-ingest helpers", () => {
  it("generates forge-ingest tokens", () => {
    const a = generateIngestToken();
    const b = generateIngestToken();
    assert.match(a, /^forge-ingest-/);
    assert.notEqual(a, b);
    assert.ok(a.length > 24);
  });

  it("normalizes titles", () => {
    assert.equal(normalizeIngestTitle("  Hello  "), "Hello");
    assert.equal(normalizeIngestTitle("   "), "Untitled draft");
    assert.equal(normalizeIngestTitle("x".repeat(400)).length, 300);
  });

  it("defaults status to review", () => {
    assert.equal(resolveIngestStatus(null), "review");
    assert.equal(resolveIngestStatus(undefined), "review");
    assert.equal(resolveIngestStatus("draft"), "draft");
    assert.equal(resolveIngestStatus("bogus"), "review");
  });

  it("resolves channels", () => {
    assert.equal(resolveIngestChannel("linkedin"), "linkedin");
    assert.equal(resolveIngestChannel("Twitter"), "x");
    assert.equal(resolveIngestChannel("nope"), null);
    assert.equal(resolveIngestChannel(null), null);
  });

  it("builds ingest URL", () => {
    assert.equal(
      buildContentIngestUrl("http://127.0.0.1:3000/"),
      "http://127.0.0.1:3000/api/content/ingest",
    );
  });
});
