/**
 * Rich composer — message parsing.
 *
 * Extracts:
 *   - @mentions of known entities (e.g. @Customer, @stripe-api, @"Customer onboarding")
 *   - Leading /slash commands (e.g. /export pdf, /name "Onboarding flow")
 *
 * Pure functions, no React. Safe to unit test in isolation.
 */

export type MentionKind =
  | "node"
  | "step"
  | "system"
  | "actor"
  | "department"
  | "custom";

export interface Mentionable {
  /** Stable reference id (e.g. Mermaid node id, system slug). */
  ref?: string;
  /** Display label users see and type after @. */
  label: string;
  kind: MentionKind;
  /** Optional second-line hint in the @ suggestion list. */
  description?: string;
}

export interface ParsedMention {
  /** Resolved mentionable (matched by label, case-insensitive). */
  mentionable: Mentionable | null;
  /** Text the user actually wrote, e.g. `@"Customer onboarding"` or `@customer`. */
  raw: string;
  /** Range in the input string [start, end). */
  range: readonly [number, number];
  /** Display label (for rendered chip). */
  label: string;
  kind: MentionKind;
}

export interface SlashCommand {
  command: string;
  args: string;
  range: readonly [number, number];
}

export interface ParsedMessage {
  raw: string;
  mentions: ParsedMention[];
  slash: SlashCommand | null;
}

const QUOTED_MENTION_RE = /@"([^"]+)"/g;
const BARE_MENTION_RE = /(^|\s)@([^\s,;:.!?(){}[\]]+)/g;

/**
 * Parse a message for @mentions and /slash commands.
 *
 * Quoted mentions (`@"multi word"`) take precedence over bare ones (`@label`).
 * Slash command is recognised only when the message starts with `/`.
 */
export function parseMessage(input: string, known: ReadonlyArray<Mentionable>): ParsedMessage {
  const knownLower = new Map(known.map((m) => [m.label.toLowerCase(), m] as const));

  const mentions: ParsedMention[] = [];
  const consumed: Array<[number, number]> = [];

  // 1) Quoted @mentions: @"Some Label"
  for (const m of Array.from(input.matchAll(QUOTED_MENTION_RE))) {
    if (m.index === undefined) continue;
    const label = m[1].trim();
    const start = m.index;
    const end = start + m[0].length;
    if (consumedOverlap(consumed, start, end)) continue;
    const mentionable = knownLower.get(label.toLowerCase()) ?? null;
    mentions.push({
      mentionable,
      raw: m[0],
      range: [start, end],
      label,
      kind: mentionable?.kind ?? "custom",
    });
    consumed.push([start, end]);
  }

  // 2) Bare @mentions: @label (single token, no whitespace)
  for (const m of Array.from(input.matchAll(BARE_MENTION_RE))) {
    if (m.index === undefined) continue;
    // matchAll with a leading (^|\s) capture means m.index is at the boundary
    // OR the start of the match. We re-derive the @ position.
    const matchText = m[0];
    const atIdx = matchText.indexOf("@");
    if (atIdx < 0) continue;
    const start = m.index + atIdx;
    const end = start + matchText.length - atIdx;
    const label = matchText.slice(atIdx + 1);
    if (!label) continue;
    if (consumedOverlap(consumed, start, end)) continue;
    const mentionable = knownLower.get(label.toLowerCase()) ?? null;
    mentions.push({
      mentionable,
      raw: matchText.slice(atIdx),
      range: [start, end],
      label,
      kind: mentionable?.kind ?? "custom",
    });
    consumed.push([start, end]);
  }

  mentions.sort((a, b) => a.range[0] - b.range[0]);

  // 3) Leading /slash command (only at start, or start after leading whitespace)
  const slash = parseLeadingSlash(input);

  return { raw: input, mentions, slash };
}

function consumedOverlap(ranges: ReadonlyArray<[number, number]>, start: number, end: number): boolean {
  return ranges.some(([s, e]) => start < e && end > s);
}

function parseLeadingSlash(input: string): SlashCommand | null {
  const trimmed = input.replace(/^\s+/, "");
  if (!trimmed.startsWith("/")) return null;
  // Find end of command token (first whitespace or end of string).
  const m = trimmed.match(/^\/(\S+)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  // The leading whitespace range is what we report (so callers can clear it
  // by passing the slash range to setSelection or similar).
  const leadWsLen = input.length - trimmed.length;
  const cmdStart = leadWsLen;
  const cmd = m[1];
  const args = (m[2] ?? "").trim();
  const cmdEnd = cmdStart + 1 + cmd.length;
  return { command: cmd.toLowerCase(), args, range: [cmdStart, cmdEnd + (args ? 1 + args.length : 0)] };
}

/**
 * Replace all mentions in `input` with their display form, e.g.
 * `@"Customer onboarding"` → `@"Customer onboarding"` (unchanged) or
 * `@customer` → `@Customer` (canonical case).
 *
 * Returns the new string and a list of (label, ref) tuples for the resolved
 * mentions, in order. Used by the chat send path to attach `nodeContext`.
 */
export function canonicaliseMentions(
  input: string,
  parsed: ParsedMessage,
): { text: string; resolved: Array<{ kind: MentionKind; label: string; ref?: string }> } {
  const resolved: Array<{ kind: MentionKind; label: string; ref?: string }> = [];
  for (const m of parsed.mentions) {
    if (m.mentionable) {
      resolved.push({ kind: m.mentionable.kind, label: m.mentionable.label, ref: m.mentionable.ref });
    } else {
      resolved.push({ kind: m.kind, label: m.label });
    }
  }
  // Keep raw text as the user typed it for display fidelity. The API only needs
  // the resolved list to build nodeContext.
  return { text: input, resolved };
}
