import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORGE_RUNTIME_EVENT_NAMES,
  forgeRuntimeEventName,
  isApprovalResolvedEvent,
  normalizeRuntimeEvent,
  normalizeToolActivity,
  parsePendingRunApproval,
  pruneToolActivities,
  reduceToolActivities,
  sanitizeToolPreview,
  toolCategoryForName,
  toolEventsFromOpenAiChunk,
  toolLabelForName,
} from "../../lib/chatbar/runtime-events.ts";

describe("forgeRuntimeEventName", () => {
  it("maps stable names and rejects control events", () => {
    assert.equal(forgeRuntimeEventName("toolStarted"), "tool.started");
    assert.equal(forgeRuntimeEventName("browser.control.started"), "runtime.unknown");
    assert.equal(
      Object.values(FORGE_RUNTIME_EVENT_NAMES).some((n) =>
        /browser\.control|control\./.test(n),
      ),
      false,
    );
  });
});

describe("normalizeRuntimeEvent", () => {
  it("maps hermes.tool.progress aliases", () => {
    const started = normalizeRuntimeEvent({
      type: "hermes.tool.progress",
      data: { tool_name: "read_file", status: "started", preview: "README.md" },
    });
    assert.equal(started.name, "tool.started");
    assert.equal(started.toolName, "read_file");
    assert.equal(started.status, "started");
    assert.match(String(started.preview), /README/);
  });

  it("redacts secrets in previews", () => {
    const finished = normalizeRuntimeEvent({
      type: "tool.finished",
      data: {
        name: "terminal",
        status: "completed",
        preview: "Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz",
      },
    });
    assert.equal(finished.name, "tool.finished");
    assert.doesNotMatch(String(finished.preview), /sk-abcdefghijklmnopqrstuvwxyz/);
  });
});

describe("normalizeToolActivity + reduceToolActivities", () => {
  it("builds friendly labels and categories", () => {
    assert.equal(toolCategoryForName("read_file"), "file");
    assert.equal(toolLabelForName("read_file"), "Reading file");
    const a = normalizeToolActivity({
      tool_name: "web_search",
      status: "started",
      preview: "acme pricing",
      tool_call_id: "call-1",
    });
    assert.equal(a.category, "web");
    assert.equal(a.activityId, "call-1");
    assert.match(a.label, /web|Search/i);
  });

  it("upserts by activity id and marks finished", () => {
    let list = reduceToolActivities([], {
      type: "tool.started",
      data: { tool_name: "terminal", tool_call_id: "t1", preview: "ls" },
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].status, "started");

    list = reduceToolActivities(list, {
      type: "tool.finished",
      data: { tool_name: "terminal", tool_call_id: "t1", status: "completed" },
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].status, "completed");
  });

  it("prunes to max length", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      normalizeToolActivity({ tool_name: `t${i}`, tool_call_id: `id-${i}` }),
    );
    assert.equal(pruneToolActivities(many, { max: 5 }).length, 5);
  });
});

describe("sanitizeToolPreview", () => {
  it("clamps length", () => {
    const long = "x".repeat(200);
    assert.ok(sanitizeToolPreview(long, 20).length <= 20);
  });
});

describe("approval events", () => {
  it("aliases Hermes approval.request to approval.requested", () => {
    const n = normalizeRuntimeEvent({
      type: "approval.request",
      run_id: "run_1",
      command: "rm -rf /tmp/x",
      description: "Destructive delete",
      choices: ["once", "session", "always", "deny"],
    });
    assert.equal(n.name, FORGE_RUNTIME_EVENT_NAMES.approvalRequested);
  });

  it("parses pending approval with choices and run id", () => {
    const pending = parsePendingRunApproval({
      event: "approval.request",
      run_id: "run_abc",
      command: "sudo reboot",
      description: "Host reboot",
      choices: ["once", "deny"],
    });
    assert.ok(pending);
    assert.equal(pending!.runId, "run_abc");
    assert.match(pending!.command, /reboot/);
    assert.deepEqual(pending!.choices, ["once", "deny"]);
  });

  it("parses studio nested envelope", () => {
    const pending = parsePendingRunApproval({
      name: "approval.requested",
      data: {
        command: "ls",
        description: "List files",
        run_id: "run_nested",
        choices: ["once", "session", "deny"],
      },
      event: {
        type: "approval.request",
        run_id: "run_nested",
        command: "ls",
      },
    });
    assert.ok(pending);
    assert.equal(pending!.runId, "run_nested");
  });

  it("detects approval.responded as resolved", () => {
    assert.equal(
      isApprovalResolvedEvent({ type: "approval.responded", choice: "once" }),
      true,
    );
    assert.equal(
      isApprovalResolvedEvent({ type: "tool.started", tool_name: "x" }),
      false,
    );
  });

  it("returns null without run id", () => {
    assert.equal(
      parsePendingRunApproval({
        type: "approval.request",
        command: "echo hi",
      }),
      null,
    );
  });
});

describe("toolEventsFromOpenAiChunk", () => {
  it("extracts tool_calls from OpenAI deltas", () => {
    const events = toolEventsFromOpenAiChunk({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                id: "call_abc",
                function: { name: "read_file", arguments: '{"path":"a.md"}' },
              },
            ],
          },
        },
      ],
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "tool.started");
    const data = events[0].data as Record<string, unknown>;
    assert.equal(data.tool_name, "read_file");
    assert.equal(data.tool_call_id, "call_abc");
  });
});
