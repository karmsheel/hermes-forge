/** Chatbar agent picker labels and route rules for Forge Overlord. */

export function formatChatbarAgentLabel(
  agent: { displayName: string; profileKey?: string | null },
  overlordProfileKey?: string | null,
): string {
  const name = agent.displayName?.trim() || "Agent";
  const key = overlordProfileKey?.trim();
  if (key && agent.profileKey === key) {
    return `Overlord (${name})`;
  }
  return name;
}

/**
 * Put Forge Overlord first in the picker, then remaining hired agents
 * in the order they arrived (usually isDefault / displayName from API).
 */
export function sortChatbarAgentsWithOverlordFirst<
  T extends { profileKey?: string | null },
>(agents: T[], overlordProfileKey?: string | null): T[] {
  const key = overlordProfileKey?.trim();
  if (!key || agents.length <= 1) return agents;
  const overlord = agents.filter((a) => a.profileKey === key);
  const rest = agents.filter((a) => a.profileKey !== key);
  return overlord.length ? [...overlord, ...rest] : agents;
}

/**
 * Routes where the agent picker is locked to the Forge Overlord
 * (Business Manager, Workshop process mapping). Other rooms allow hired agents.
 */
export function isChatbarOverlordOnlyPath(pathname: string): boolean {
  return (
    pathname.startsWith("/business-manager") ||
    pathname.startsWith("/workshop")
  );
}

export function isChatbarHiddenPath(pathname: string): boolean {
  return pathname.startsWith("/setup");
}
