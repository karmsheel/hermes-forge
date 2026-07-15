/**
 * Business systems / tools for @-mentions (backlog 3.5 / 4.10).
 * Extracted from discovery answers, free text, and known product names.
 */

export interface SystemMentionable {
  ref: string;
  label: string;
  kind: "system";
  description?: string;
}

/** Well-known product / platform names (conservative; case-insensitive match). */
export const KNOWN_SYSTEM_PATTERN =
  /\b(?:Salesforce|HubSpot|Slack|Jira|Notion|Excel|Google Sheets|Sheets|SAP|Workday|Zendesk|Stripe|QuickBooks|n8n|Hermes|Gmail|Outlook|SharePoint|ServiceNow|Asana|Linear|GitHub|Airtable|Shopify|WordPress|Mailchimp|Intercom|Twilio|AWS|Azure|GCP|Google Drive|Dropbox|DocuSign|Calendly|Zoom|Teams|Microsoft Teams|Monday\.com|Trello|ClickUp|Xero|Freshdesk|Pipedrive|Typeform|Zapier)\b/gi;

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function slugSystem(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "system"
  );
}

/**
 * Split free-text "systems involved" answers into candidate names.
 * Handles commas, semicolons, newlines, and " and " / " & " lists.
 */
export function splitSystemList(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];

  const parts = text
    .split(/[\n;]|,(?![^()]*\))|\s+\/\s+|\s+&\s+|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      // Strip leading bullets / numbering
      p
        .replace(/^[-*•]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(/\.+$/, "")
        .trim()
    )
    .filter((p) => {
      if (p.length < 2 || p.length > 48) return false;
      // Drop pure prose sentences (likely not a system name)
      if (p.split(/\s+/).length > 5) return false;
      // Drop questions
      if (/\?$/.test(p)) return false;
      return true;
    });

  return uniquePreserveOrder(parts);
}

/** Match known product tokens in free text. */
export function matchKnownSystems(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const matches = text.match(KNOWN_SYSTEM_PATTERN) ?? [];
  // Normalize casing to first-seen original match
  return uniquePreserveOrder(matches);
}

/**
 * Collect system names from process discovery / description fields.
 * Prefers explicit list parsing of `inputs` (Questions tab: Systems involved).
 */
export function extractSystemsFromFields(fields: {
  inputs?: string | null;
  outputs?: string | null;
  manualSteps?: string | null;
  description?: string | null;
  trigger?: string | null;
  name?: string | null;
}): string[] {
  const fromInputs = splitSystemList(fields.inputs);
  const blob = [fields.inputs, fields.outputs, fields.manualSteps, fields.description, fields.trigger, fields.name]
    .filter(Boolean)
    .join(" ");
  const known = matchKnownSystems(blob);
  return uniquePreserveOrder([...fromInputs, ...known]);
}

/** Aggregate systems across many processes (e.g. PROCESS.md). */
export function extractSystemsFromProcesses(
  processes: Array<{
    inputs?: string | null;
    outputs?: string | null;
    manualSteps?: string | null;
    description?: string | null;
    trigger?: string | null;
    name?: string | null;
  }>
): string[] {
  const all: string[] = [];
  for (const p of processes) {
    all.push(...extractSystemsFromFields(p));
  }
  return uniquePreserveOrder(all);
}

/** Rich-composer @-mention candidates. */
export function systemsToMentionables(systems: string[]): SystemMentionable[] {
  return uniquePreserveOrder(systems).map((label) => ({
    ref: `system:${slugSystem(label)}`,
    label,
    kind: "system" as const,
    description: "system / tool",
  }));
}

/** Compact block for Hermes system prompts. Empty → "". */
export function formatSystemsPromptContext(systems: string[]): string {
  const list = uniquePreserveOrder(systems);
  if (list.length === 0) return "";
  return [
    "Known systems / tools for this process (prefer these names; do not invent others unless the user does):",
    ...list.map((s) => `- ${s}`),
    "When the user @-mentions a system, treat that as the tool or platform used in the step they are discussing.",
  ].join("\n");
}
