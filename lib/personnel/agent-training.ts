/** Agent Academy training kinds and helpers. */

export const AGENT_TRAINING_KINDS = ["skill", "soul", "profile"] as const;
export type AgentTrainingKind = (typeof AGENT_TRAINING_KINDS)[number];

export const AGENT_TRAINING_SOURCES = ["upload", "library"] as const;
export type AgentTrainingSource = (typeof AGENT_TRAINING_SOURCES)[number];

export function isAgentTrainingKind(value: unknown): value is AgentTrainingKind {
  return (
    typeof value === "string" &&
    (AGENT_TRAINING_KINDS as readonly string[]).includes(value)
  );
}

export function labelForTrainingKind(kind: string): string {
  switch (kind) {
    case "skill":
      return "Skill";
    case "soul":
      return "Soul profile";
    case "profile":
      return "Agent profile";
    default:
      return kind;
  }
}

/** Truncate training content for system prompts. */
export function formatTrainingForPrompt(
  items: Array<{ kind: string; name: string; content: string }>,
  maxCharsPerItem = 2500,
  maxItems = 8,
): string {
  if (!items.length) return "";
  const lines: string[] = ["Agent training (Agent Academy):"];
  for (const item of items.slice(0, maxItems)) {
    const body =
      item.content.length > maxCharsPerItem
        ? `${item.content.slice(0, maxCharsPerItem)}\n…[truncated]`
        : item.content;
    lines.push(
      "",
      `### ${labelForTrainingKind(item.kind)}: ${item.name}`,
      body,
    );
  }
  if (items.length > maxItems) {
    lines.push("", `…and ${items.length - maxItems} more training item(s).`);
  }
  return lines.join("\n");
}
