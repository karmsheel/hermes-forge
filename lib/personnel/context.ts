/**
 * Personnel context for workshop integration (backlog 4.10 / AUDIT-10).
 * Shared by chat prompts, diagram prompts, and @-mention candidates.
 */

export type PersonnelActorKind = "human" | "agent";

export interface PersonnelActor {
  id: string;
  name: string;
  role: string;
  kind: PersonnelActorKind;
  /** Optional longer description (human roleDescription or agent description). */
  description?: string | null;
  isOwner?: boolean;
}

export interface PersonnelRoster {
  humans: PersonnelActor[];
  agents: PersonnelActor[];
  /** Distinct roles useful as department / swimlane labels. */
  departments: string[];
}

export interface PersonnelMentionable {
  ref: string;
  label: string;
  kind: "actor" | "department";
  /** Shown in composer suggestion description. */
  description?: string;
}

/** Build roster shape from Prisma-like rows. */
export function buildPersonnelRoster(input: {
  humans?: Array<{
    id: string;
    name: string;
    role: string;
    roleDescription?: string | null;
    isOwner?: boolean;
  }>;
  agents?: Array<{
    id: string;
    displayName: string;
    description?: string | null;
    isHired?: boolean;
  }>;
}): PersonnelRoster {
  const humans: PersonnelActor[] = (input.humans ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    role: h.role,
    kind: "human" as const,
    description: h.roleDescription ?? null,
    isOwner: h.isOwner,
  }));

  const agents: PersonnelActor[] = (input.agents ?? [])
    .filter((a) => a.isHired !== false)
    .map((a) => ({
      id: a.id,
      name: a.displayName,
      role: a.description?.trim() || "Hermes agent",
      kind: "agent" as const,
      description: a.description ?? null,
    }));

  const departments = uniqueRoles([...humans, ...agents].map((a) => a.role));

  return { humans, agents, departments };
}

function uniqueRoles(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of roles) {
    const t = r.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** All actors (humans first, then hired agents). */
export function allPersonnelActors(roster: PersonnelRoster): PersonnelActor[] {
  return [...roster.humans, ...roster.agents];
}

/**
 * Format roster for Hermes system prompts.
 * Empty roster → empty string (caller should skip injection).
 */
export function formatPersonnelPromptContext(roster: PersonnelRoster): string {
  const actors = allPersonnelActors(roster);
  if (actors.length === 0) return "";

  const lines: string[] = [
    "Business personnel roster (prefer these names for actors; do not invent people unless the user does):",
  ];

  for (const a of roster.humans) {
    const owner = a.isOwner ? " [owner]" : "";
    const desc = a.description?.trim() ? ` — ${a.description.trim()}` : "";
    lines.push(`- ${a.name} (${a.role}, human${owner})${desc}`);
  }
  for (const a of roster.agents) {
    const desc = a.description?.trim() ? ` — ${a.description.trim()}` : "";
    lines.push(`- ${a.name} (${a.role}, Hermes agent)${desc}`);
  }

  if (roster.departments.length > 0) {
    lines.push(`Functions / roles for swimlanes: ${roster.departments.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Extra diagram instructions when using swimlane notation + roster.
 */
export function formatSwimlanePersonnelAddon(roster: PersonnelRoster): string {
  const actors = allPersonnelActors(roster);
  if (actors.length === 0) {
    return "Swimlane: use subgraph lanes for each actor or department named in the conversation.";
  }

  const laneNames = [
    ...roster.humans.map((h) => h.name),
    ...roster.agents.map((a) => a.name),
  ];
  // Prefer named people; also allow role lanes if few people
  const uniqueLanes = uniqueRoles(laneNames);

  return [
    "Swimlane lanes MUST prefer this business roster (create a subgraph per person or role as appropriate):",
    ...uniqueLanes.map((n) => `  - ${n}`),
    "Place each step in the lane of the person/role who performs it. Show handoffs as edges between lanes.",
    "If the conversation names someone not on the roster, you may add a lane for them.",
    // Mermaid treats `default` as a lexer keyword — never use it as a subgraph/node id.
    "Subgraph IDs must be safe Mermaid identifiers (letters/numbers/underscores). Never use reserved ids: default, end, graph, class, style. If a lane is the default Hermes agent, use id hermesAgent with a display title, e.g. subgraph hermesAgent[Hermes agent].",
  ].join("\n");
}

/**
 * Convert roster to rich-composer @-mention candidates.
 * Labels prefer person names (quoted multi-word handled by composer).
 */
export function personnelToMentionables(roster: PersonnelRoster): PersonnelMentionable[] {
  const out: PersonnelMentionable[] = [];

  for (const a of roster.humans) {
    out.push({
      ref: `human:${a.id}`,
      label: a.name,
      kind: "actor",
      description: a.isOwner ? `${a.role} · owner` : `${a.role} · human`,
    });
  }
  for (const a of roster.agents) {
    out.push({
      ref: `agent:${a.id}`,
      label: a.name,
      kind: "actor",
      description: `${a.role} · agent`,
    });
  }
  for (const dept of roster.departments) {
    // Avoid duplicating if a person is named exactly like a role
    if (out.some((m) => m.label.toLowerCase() === dept.toLowerCase())) continue;
    out.push({
      ref: `role:${dept.toLowerCase().replace(/\s+/g, "-")}`,
      label: dept,
      kind: "department",
      description: "function / role",
    });
  }

  return out;
}
