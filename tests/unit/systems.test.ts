import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractSystemsFromFields,
  extractSystemsFromProcesses,
  formatSystemsPromptContext,
  matchKnownSystems,
  splitSystemList,
  systemsToMentionables,
} from "@/lib/systems";

describe("splitSystemList", () => {
  it("splits commas and and", () => {
    const list = splitSystemList("Shopify, Slack, and Google Sheets");
    assert.ok(list.includes("Shopify"));
    assert.ok(list.includes("Slack"));
    assert.ok(list.includes("Google Sheets"));
  });

  it("handles newlines and bullets", () => {
    const list = splitSystemList("- HubSpot\n- Zendesk");
    assert.deepEqual(list, ["HubSpot", "Zendesk"]);
  });

  it("drops long prose", () => {
    const list = splitSystemList(
      "We mostly use email but sometimes people send faxes across the whole region"
    );
    assert.equal(list.length, 0);
  });
});

describe("matchKnownSystems", () => {
  it("finds known products in free text", () => {
    const list = matchKnownSystems("Sync deals from Salesforce into Slack");
    assert.ok(list.some((s) => /salesforce/i.test(s)));
    assert.ok(list.some((s) => /slack/i.test(s)));
  });
});

describe("extractSystemsFromFields", () => {
  it("merges list parse with known names", () => {
    const list = extractSystemsFromFields({
      inputs: "Custom CRM, warehouse app",
      description: "Posts alerts to Slack when inventory is low",
    });
    assert.ok(list.includes("Custom CRM"));
    assert.ok(list.includes("warehouse app"));
    assert.ok(list.some((s) => /slack/i.test(s)));
  });
});

describe("extractSystemsFromProcesses", () => {
  it("aggregates across processes", () => {
    const list = extractSystemsFromProcesses([
      { inputs: "Shopify" },
      { description: "Email via Gmail" },
    ]);
    assert.ok(list.includes("Shopify"));
    assert.ok(list.some((s) => /gmail/i.test(s)));
  });
});

describe("systemsToMentionables", () => {
  it("emits system kind with stable refs", () => {
    const m = systemsToMentionables(["Shopify", "Shopify", "Slack"]);
    assert.equal(m.length, 2);
    assert.equal(m[0].kind, "system");
    assert.match(m[0].ref, /^system:/);
    assert.equal(m[0].label, "Shopify");
  });
});

describe("formatSystemsPromptContext", () => {
  it("returns empty for no systems", () => {
    assert.equal(formatSystemsPromptContext([]), "");
  });

  it("lists systems for the agent", () => {
    const text = formatSystemsPromptContext(["Shopify", "Slack"]);
    assert.match(text, /Shopify/);
    assert.match(text, /@-mentions a system/);
  });
});
