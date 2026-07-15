import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSplitCandidates,
  parseMermaidGraph,
  connectedComponents,
  formatSplitAnalysisForPrompt,
} from "@/lib/mermaid-graph";
import {
  assistantProposedSplit,
  parseSplitPlan,
  shouldExecuteSplit,
  userConfirmsSplit,
  userRequestsSplit,
} from "@/lib/process-split";

const TWO_FLOWS = `flowchart TD
  startA([New order]) --> pack[Pack order]
  pack --> ship[Ship order]
  ship --> doneA([Done])

  startB([Return request]) --> inspect[Inspect item]
  inspect --> refund[Issue refund]
  refund --> doneB([Done])
`;

const SINGLE_BRANCH = `flowchart TD
  start([New lead]) --> qualify{Qualified?}
  qualify -->|Yes| demo[Schedule demo]
  qualify -->|No| archive[Archive lead]
  demo --> close{Won?}
  close -->|Yes| onboard[Onboard]
  close -->|No| nurture[Nurture]
`;

describe("parseMermaidGraph", () => {
  it("parses nodes and edges", () => {
    const g = parseMermaidGraph(SINGLE_BRANCH);
    assert.ok(g);
    assert.ok(g!.nodes.has("start"));
    assert.ok(g!.nodes.has("qualify"));
    assert.ok(g!.edges.length >= 4);
    assert.equal(g!.nodes.get("start")?.isStartLike, true);
  });

  it("finds one component for a branching flow", () => {
    const g = parseMermaidGraph(SINGLE_BRANCH)!;
    const comps = connectedComponents(g);
    assert.equal(comps.length, 1);
  });

  it("finds two components for disconnected flows", () => {
    const g = parseMermaidGraph(TWO_FLOWS)!;
    const comps = connectedComponents(g);
    assert.equal(comps.length, 2);
  });
});

describe("analyzeSplitCandidates", () => {
  it("shows split button for disconnected multi-flow diagrams", () => {
    const a = analyzeSplitCandidates(TWO_FLOWS);
    assert.equal(a.canSplit, true);
    assert.equal(a.showSplitButton, true);
    assert.equal(a.confidence, "high");
    assert.ok(a.componentCount >= 2);
    assert.ok(a.components.length >= 2);
  });

  it("does not show split button for a single branching process", () => {
    const a = analyzeSplitCandidates(SINGLE_BRANCH);
    assert.equal(a.showSplitButton, false);
    assert.equal(a.confidence, "none");
    assert.equal(a.canSplit, false);
  });

  it("returns none for empty or tiny diagrams", () => {
    assert.equal(analyzeSplitCandidates(null).confidence, "none");
    assert.equal(
      analyzeSplitCandidates("flowchart TD\nA[One] --> B[Two]").showSplitButton,
      false
    );
  });

  it("formats a non-empty prompt note when splitable", () => {
    const note = formatSplitAnalysisForPrompt(analyzeSplitCandidates(TWO_FLOWS));
    assert.match(note, /confidence: high/i);
    assert.match(note, /Candidate flows/i);
  });
});

describe("process-split helpers", () => {
  it("detects user split requests and confirmations", () => {
    assert.equal(userRequestsSplit("Please split this into two workflows"), true);
    assert.equal(userConfirmsSplit("yes, go ahead"), true);
    assert.equal(userConfirmsSplit("no, keep them together"), false);
  });

  it("detects assistant split proposals", () => {
    assert.equal(
      assistantProposedSplit(
        "This looks like two distinct processes. Should I split the returns flow into its own workflow?"
      ),
      true
    );
  });

  it("shouldExecuteSplit works on forged and draft processes", () => {
    assert.equal(
      shouldExecuteSplit({
        userContent: "split this into two",
        status: "forged",
      }),
      true
    );
    assert.equal(
      shouldExecuteSplit({
        userContent: "split this into two",
        status: "mapping",
      }),
      true
    );
  });

  it("parseSplitPlan sanitizes mermaid", () => {
    const plan = parseSplitPlan({
      parent: {
        name: "Orders",
        description: "Order path",
        diagramMermaid: "```mermaid\nflowchart TD\nA[Start] --> B[End]\n```",
        assistantNote: "Kept orders",
      },
      child: {
        name: "Returns",
        description: "Return path",
        diagramMermaid: "flowchart TD\nX[Return] --> Y[Refund]",
        assistantNote: "Peel returns",
      },
    });
    assert.ok(plan);
    assert.equal(plan!.parent.name, "Orders");
    assert.match(plan!.parent.diagramMermaid, /flowchart TD/);
    assert.doesNotMatch(plan!.parent.diagramMermaid, /```/);
  });
});
