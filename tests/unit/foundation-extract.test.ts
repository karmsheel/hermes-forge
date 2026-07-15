import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  annotateDuplicates,
  extractDraftsFromText,
  messagesToTranscript,
  parseForgeDraftsFence,
} from "../../lib/foundation-extract.ts";

describe("parseForgeDraftsFence", () => {
  it("parses forge-drafts fenced JSON array", () => {
    const text = `Here are some drafts:

\`\`\`forge-drafts
[
  {"name":"Twitter content","department":"Marketing","ioShape":"simo","outputs":"Posts + analytics"},
  {"name":"Order fulfillment","department":"Operations","ioShape":"siso"}
]
\`\`\`
`;
    const drafts = parseForgeDraftsFence(text);
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].name, "Twitter content");
    assert.equal(drafts[0].ioShape, "simo");
    assert.equal(drafts[1].name, "Order fulfillment");
  });

  it("parses object with drafts key", () => {
    const text = `\`\`\`json
{"drafts":[{"name":"Lead intake","description":"Form to CRM"}]}
\`\`\``;
    const drafts = parseForgeDraftsFence(text);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].name, "Lead intake");
  });

  it("returns empty when no fence", () => {
    assert.deepEqual(parseForgeDraftsFence("Just a chat reply"), []);
  });
});

describe("annotateDuplicates", () => {
  it("flags existing process names", () => {
    const rows = annotateDuplicates(
      [{ name: "Fulfillment" }, { name: "New thing" }],
      [{ id: "p1", name: "fulfillment" }]
    );
    assert.equal(rows[0].isDuplicate, true);
    assert.equal(rows[0].existingProcessId, "p1");
    assert.equal(rows[1].isDuplicate, false);
  });
});

describe("extractDraftsFromText", () => {
  it("returns fence source when present", () => {
    const r = extractDraftsFromText(
      "```forge-drafts\n[{\"name\":\"A\"}]\n```",
      []
    );
    assert.equal(r.source, "fence");
    assert.equal(r.drafts.length, 1);
  });

  it("returns empty when nothing parseable", () => {
    const r = extractDraftsFromText("hello", []);
    assert.equal(r.source, "empty");
    assert.equal(r.drafts.length, 0);
  });
});

describe("messagesToTranscript", () => {
  it("formats roles", () => {
    const t = messagesToTranscript([
      { role: "user", content: "We sell widgets" },
      { role: "assistant", content: "Noted" },
    ]);
    assert.match(t, /USER: We sell widgets/);
    assert.match(t, /ASSISTANT: Noted/);
  });
});
