import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  documentsPromptAddon,
  documentKindLabel,
  getSeedTemplates,
  selectDocumentsForContext,
  slugifyDocumentTitle,
} from "../../lib/document-kinds.ts";
import { simpleMarkdownToHtml } from "../../lib/markdown-simple.ts";

describe("slugifyDocumentTitle", () => {
  it("normalizes titles", () => {
    assert.equal(slugifyDocumentTitle("Market Notes!"), "market-notes");
    assert.equal(slugifyDocumentTitle("  "), "document");
  });
});

describe("getSeedTemplates", () => {
  it("includes four core kinds with basics pinned", () => {
    const seeds = getSeedTemplates();
    assert.equal(seeds.length, 4);
    assert.ok(seeds.every((s) => s.bodyMarkdown.includes("#")));
    const basics = seeds.find((s) => s.slug === "basics");
    assert.ok(basics?.pinnedForContext);
  });
});

describe("selectDocumentsForContext", () => {
  it("always includes basics and pinned docs", () => {
    const selected = selectDocumentsForContext([
      {
        title: "Basics",
        kind: "basics",
        slug: "basics",
        bodyMarkdown: "purpose",
        pinnedForContext: false,
      },
      {
        title: "Market",
        kind: "market",
        slug: "market",
        bodyMarkdown: "comp",
        pinnedForContext: true,
      },
      {
        title: "Note",
        kind: "freeform",
        slug: "note",
        bodyMarkdown: "x",
        pinnedForContext: false,
      },
    ]);
    assert.equal(selected.length, 2);
    assert.deepEqual(
      selected.map((d) => d.slug).sort(),
      ["basics", "market"],
    );
  });
});

describe("documentsPromptAddon", () => {
  it("returns empty when no docs", () => {
    assert.equal(documentsPromptAddon([]), "");
  });

  it("includes document titles", () => {
    const addon = documentsPromptAddon([
      {
        title: "Business basics",
        kind: "basics",
        slug: "basics",
        bodyMarkdown: "We sell widgets.",
        pinnedForContext: true,
      },
    ]);
    assert.match(addon, /Business knowledge documents/);
    assert.match(addon, /Business basics/);
    assert.match(addon, /widgets/);
  });
});

describe("documentKindLabel", () => {
  it("labels known kinds", () => {
    assert.equal(documentKindLabel("customers"), "Customers");
  });
});

describe("simpleMarkdownToHtml", () => {
  it("escapes raw html and renders heading", () => {
    const html = simpleMarkdownToHtml("# Hello\n\n<script>x</script>");
    assert.match(html, /<h1/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });
});
