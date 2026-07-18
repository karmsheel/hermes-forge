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
 * On Business Manager the user only talks to the Forge Overlord.
 * Inside a business, hired agents become selectable.
 */
export function isChatbarOverlordOnlyPath(pathname: string): boolean {
  return pathname.startsWith("/business-manager");
}

export function isChatbarHiddenPath(pathname: string): boolean {
  return pathname.startsWith("/setup");
}
