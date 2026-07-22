import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeMermaidSource } from "../../lib/mermaid-sanitize.ts";

/** LinkedIn Daily Posting (Hyperion Labs) — real diagram that failed to render. */
const LINKEDIN_DAILY_POSTING = `flowchart TD
  subgraph Kams
    trigger([Daily schedule])
    approval[Approve draft post]
    flag[Flag missing brief]
  end
  subgraph default[Hermes agent]
    buffer[Content buffer]
    pull[Pull from buffer]
    review[Review brief]
    draft[Draft LinkedIn post]
    revise[Revise draft post]
    publish([Publish post])
    done([Published post])
  end
  trigger --> pull
  buffer --> pull
  pull --> review
  review --> ready{Ready?}
  ready -->|Yes| draft
  ready -->|No| flag
  flag --> pull
  draft --> approval
  approval --> ok{Approved?}
  ok -->|Yes| publish
  ok -->|No| revise
  revise --> draft`;

describe("sanitizeMermaidSource", () => {
  it("renames reserved subgraph id default (Mermaid DEFAULT token)", () => {
    const out = sanitizeMermaidSource(
      "flowchart TD\n  subgraph default[Hermes agent]\n    a[A]\n  end\n  a --> b[B]",
    );
    assert.match(out, /subgraph\s+defaultNode\[Hermes agent\]/);
    assert.doesNotMatch(out, /subgraph\s+default\[/);
  });

  it("renames bare subgraph default", () => {
    const out = sanitizeMermaidSource(
      "flowchart TD\n  subgraph default\n    a[A]\n  end\n  a --> b[B]",
    );
    assert.match(out, /subgraph\s+defaultNode\b/);
    assert.doesNotMatch(out, /subgraph\s+default\s*$/m);
  });

  it("renames reserved node id default", () => {
    const out = sanitizeMermaidSource("flowchart TD\n  default[Step] --> b[Next]");
    assert.match(out, /defaultNode\[Step\]/);
    assert.doesNotMatch(out, /^\s*default\[/m);
  });

  it("still renames reserved end node id without breaking subgraph closers", () => {
    const out = sanitizeMermaidSource(
      "flowchart TD\n  subgraph lane\n    start([Go]) --> end([Done])\n  end",
    );
    assert.match(out, /finish\(\[Done\]\)/);
    // Closing end for subgraph must remain
    assert.match(out, /^\s*end\s*$/m);
  });

  it("fixes Hyperion Labs LinkedIn daily posting diagram", () => {
    const out = sanitizeMermaidSource(LINKEDIN_DAILY_POSTING);
    assert.match(out, /subgraph\s+defaultNode\[Hermes agent\]/);
    assert.doesNotMatch(out, /subgraph\s+default\[/);
    // Structure preserved
    assert.match(out, /trigger --> pull/);
    assert.match(out, /ready -->\|Yes\| draft/);
    assert.match(out, /ok -->\|No\| revise/);
    // Subgraph closers intact
    const ends = out.match(/^\s*end\s*$/gm) ?? [];
    assert.equal(ends.length, 2);
  });

  it("is case-insensitive for reserved ids", () => {
    const out = sanitizeMermaidSource(
      "flowchart TD\n  subgraph Default[Agent]\n    A[A]\n  end",
    );
    assert.match(out, /subgraph\s+defaultNode\[Agent\]/i);
  });
});
