/**
 * Rich composer — slash command registry.
 *
 * Each command is a small descriptor (label, hint, args hint) plus a handler.
 * Commands that the parent page needs to react to (e.g. /export opening a menu)
 * return a `handled` flag from a callback the parent supplies.
 */

export interface SlashCommandDescriptor {
  /** Command name without leading slash. Lowercased. */
  command: string;
  /** Short human label shown in the suggestion list. */
  label: string;
  /** One-line description of what the command does. */
  description: string;
  /** Optional argument hint (e.g. "md | mermaid | pdf"). */
  argHint?: string;
  /**
   * If set, the command is handled client-side (e.g. just expands to a canned
   * prompt). If omitted, the parent page is responsible for handling the
   * command via `onSlashCommand`.
   */
  handler?: (args: string) => string | null;
}

export const SLASH_COMMANDS: ReadonlyArray<SlashCommandDescriptor> = [
  {
    command: "help",
    label: "Show command list",
    description: "List all available slash commands.",
    handler: () =>
      "Available commands:\n" +
      SLASH_COMMANDS.map((c) => `/${c.command}${c.argHint ? ` <${c.argHint}>` : ""} — ${c.description}`).join("\n"),
  },
  {
    command: "name",
    label: "Rename this process",
    description: "Suggest a new name for the current process.",
    argHint: "name",
    handler: (args) =>
      args.trim()
        ? `Please rename this process to "${args.trim()}".`
        : "Please suggest a clear, concise name for this process.",
  },
  {
    command: "add-step",
    label: "Add a step",
    description: "Ask the agent to add a missing step to the diagram.",
    argHint: "description",
    handler: (args) =>
      args.trim()
        ? `Add a new step to the diagram: ${args.trim()}`
        : "Review the diagram and suggest any missing steps.",
  },
  {
    command: "simplify",
    label: "Simplify the diagram",
    description: "Ask the agent to reduce the diagram to its essentials.",
    handler: () =>
      "Review the current diagram. If any step is redundant, merge it with the adjacent step. Show me the simplified result.",
  },
  {
    command: "export",
    label: "Open the export menu",
    description: "Switch to the Export tab (Markdown, Mermaid, PNG, PDF, Cursor bundle).",
    argHint: "md | mermaid | png | pdf",
    // No handler — parent page routes this to the Export tab.
  },
  {
    command: "accuracy",
    label: "Confirm accuracy",
    description: "Tell Hermes the current map is accurate.",
    handler: () => "Yes, this is accurate.",
  },
];

export function findSlashCommand(name: string): SlashCommandDescriptor | undefined {
  return SLASH_COMMANDS.find((c) => c.command === name.toLowerCase());
}

/**
 * Filter slash commands by a query string. If the query is empty, all are
 * returned. Otherwise commands whose name/label starts with the query win
 * first; description-contains matches come after.
 */
export function filterSlashCommands(query: string): SlashCommandDescriptor[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS.slice();
  const starts: SlashCommandDescriptor[] = [];
  const contains: SlashCommandDescriptor[] = [];
  for (const c of SLASH_COMMANDS) {
    if (c.command.startsWith(q) || c.label.toLowerCase().startsWith(q)) starts.push(c);
    else if (
      c.description.toLowerCase().includes(q) ||
      (c.argHint ?? "").toLowerCase().includes(q)
    )
      contains.push(c);
  }
  return [...starts, ...contains];
}

/**
 * Filter mentionables by query (case-insensitive substring on label).
 */
export function filterMentionables<T extends { label: string }>(items: ReadonlyArray<T>, query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, 20);
  return items.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 20);
}
