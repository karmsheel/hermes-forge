import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageBlurbForPath } from "../../lib/chatbar/page-registry.ts";
import {
  autoStudioTitleFromText,
  buildStudioChatSystemPrompt,
  buildStudioPageContextMessage,
} from "../../lib/chatbar/studio-prompt.ts";

describe("pageBlurbForPath", () => {
  it("resolves known routes", () => {
    assert.equal(pageBlurbForPath("/home").routeKey, "home");
    assert.equal(pageBlurbForPath("/foundation").routeKey, "foundation");
    assert.equal(pageBlurbForPath("/functions").title, "Functions");
    assert.equal(pageBlurbForPath("/workshop/x").routeKey, "workshop");
    assert.equal(pageBlurbForPath("/documents").routeKey, "documents");
    assert.equal(pageBlurbForPath("/automations/abc").routeKey, "automation-studio");
    assert.equal(pageBlurbForPath("/automations").routeKey, "automations");
  });

  it("falls back for unknown routes", () => {
    assert.equal(pageBlurbForPath("/mystery").routeKey, "unknown");
  });
});

describe("studio prompts", () => {
  it("includes business and page purpose", () => {
    const system = buildStudioChatSystemPrompt({
      businessName: "Acme",
      route: "/personnel",
    });
    assert.match(system, /Acme/);
    assert.match(system, /Personnel/);
  });

  it("adds Foundation plant-sketch guidance on /foundation", () => {
    const system = buildStudioChatSystemPrompt({
      businessName: "Acme",
      route: "/foundation",
    });
    assert.match(system, /Foundation/i);
    assert.match(system, /Overlord/);
    assert.match(system, /plant sketch|I\/O shape|draft process/i);
  });

  it("includes hired agent identity when provided", () => {
    const system = buildStudioChatSystemPrompt({
      businessName: "Acme",
      route: "/home",
      agent: {
        displayName: "Ops Pilot",
        description: "Keeps operations tidy",
        profileKey: "ops",
      },
      trainingPrompt: "Agent training (Agent Academy):\n### Skill: Mapping",
    });
    assert.match(system, /Ops Pilot/);
    assert.match(system, /operations tidy/i);
    assert.match(system, /Agent training/);
  });

  it("wraps page context as untrusted", () => {
    const block = buildStudioPageContextMessage({
      route: "/log",
      businessName: "Acme",
    });
    assert.match(block, /UNTRUSTED_FORGE_CONTEXT_START/);
    assert.match(block, /Business log/);
  });

  it("auto-titles from first message", () => {
    assert.equal(autoStudioTitleFromText("What is this page?"), "What is this page?");
    assert.ok(autoStudioTitleFromText("x".repeat(80)).endsWith("…"));
  });
});
