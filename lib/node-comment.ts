/**
 * Node-comment message helpers (3.2).
 *
 * The chat API prefixes targeted node corrections with:
 *   Regarding "<label>": <user content>
 * (or the same prefix in lowercase variants). This module extracts that
 * prefix so the UI can render a clean badge in the chat bubble and the
 * diagram can decorate nodes that have comments.
 *
 * Pure functions. No React.
 */

const REGARDING_RE = /^Regarding\s+"([^"]+)":\s*([\s\S]*)$/;

/**
 * Returns `{ label, content }` if the message is a node-targeted comment,
 * or `null` if it's a regular message.
 *
 * The label is the exact Mermaid node label the user targeted. Content is
 * what the user actually wrote (after the prefix).
 */
export function parseNodeComment(
  content: string,
): { label: string; content: string } | null {
  const m = content.match(REGARDING_RE);
  if (!m) return null;
  const label = m[1].trim();
  const body = m[2];
  // Empty body is technically a comment but useless — treat as regular.
  if (!label || !body.trim()) return null;
  return { label, content: body };
}

/**
 * Build the prefix for a given node label. Single source of truth so the
 * API and the client agree on the format.
 */
export function buildNodeCommentPrefix(label: string): string {
  return `Regarding "${label}": `;
}

/**
 * Match a label case-insensitively. Useful for grouping chat messages by
 * target node when labels might have small casing differences (Mermaid
 * can normalise "Foo" vs "foo").
 */
export function normaliseLabel(label: string): string {
  return label.trim().toLowerCase();
}

/** Stable fingerprint for a per-node comment summary map. */
export function serializeNodeCommentSummary(
  map: ReadonlyMap<string, { count: number; firstLabel: string }>,
): string {
  if (map.size === 0) return "";
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}\t${value.count}\t${value.firstLabel}`)
    .join("\n");
}
