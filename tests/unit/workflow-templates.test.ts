import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  isWorkflowTemplateId,
} from "../../lib/workflow-templates.ts";

describe("workflow templates library", () => {
  it("loads curated templates from JSON catalog", () => {
    assert.ok(WORKFLOW_TEMPLATES.length >= 5);
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    assert.ok(ids.includes("content-ops"));
    assert.ok(ids.includes("sop"));
    assert.ok(ids.includes("onboarding"));
    assert.ok(ids.includes("incident"));
  });

  it("each template has required fields", () => {
    for (const t of WORKFLOW_TEMPLATES) {
      assert.ok(t.id);
      assert.ok(t.title);
      assert.ok(t.seedPrompt.length > 10);
      assert.ok(t.processName);
      assert.ok(t.gradientFrom.startsWith("#"));
      assert.ok(t.gradientTo.startsWith("#"));
    }
  });

  it("getWorkflowTemplate resolves by id", () => {
    const sop = getWorkflowTemplate("sop");
    assert.ok(sop);
    assert.equal(sop?.id, "sop");
    assert.ok(sop?.diagramMermaid);
  });

  it("isWorkflowTemplateId guards unknown ids", () => {
    assert.equal(isWorkflowTemplateId("sop"), true);
    assert.equal(isWorkflowTemplateId("not-a-template"), false);
    assert.equal(isWorkflowTemplateId(null), false);
  });
});
