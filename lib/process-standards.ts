export type ProcessStandardId = "auto" | "bpmn-lite" | "swimlane" | "flowchart";

export const DEFAULT_PROCESS_STANDARD: ProcessStandardId = "auto";
export const STANDARD_STORAGE_KEY = "hermes-forge-process-standard";

export const PROCESS_STANDARD_IDS: ProcessStandardId[] = [
  "auto",
  "bpmn-lite",
  "swimlane",
  "flowchart",
];

export interface ProcessStandard {
  id: ProcessStandardId;
  label: string;
  shortDescription: string;
  chatPromptAddon: string;
  diagramPromptAddon: string;
}

export const PROCESS_STANDARDS: ProcessStandard[] = [
  {
    id: "auto",
    label: "Model picks",
    shortDescription: "Hermes chooses the best notation for your process",
    chatPromptAddon: `Process notation: Model picks — analyze the process and choose the most appropriate style (simple flowchart, swimlane, or BPMN-lite). Mention your choice briefly if it helps the user; keep discovery focused.`,
    diagramPromptAddon: `Notation: Model picks — choose the best diagram style for this process (simple flowchart, swimlane with subgraph lanes, or BPMN-lite with events/gateways). Apply consistently once chosen.`,
  },
  {
    id: "bpmn-lite",
    label: "BPMN-lite",
    shortDescription: "Events, tasks, and gateways",
    chatPromptAddon: `Process notation: BPMN-lite — use BPMN terms (start event, task, gateway, end event) when discussing steps and handoffs.`,
    diagramPromptAddon: `Notation: BPMN-lite — use flowchart TD with rounded start/end nodes, rectangles for tasks, diamonds for gateways. Label decision edges Yes/No where applicable. Prefer BPMN-style naming in node labels.`,
  },
  {
    id: "swimlane",
    label: "Swimlane",
    shortDescription: "Steps grouped by actor or department",
    chatPromptAddon: `Process notation: Swimlane — organize discussion by actor or department lanes. Clarify who owns each step and handoffs between lanes.`,
    diagramPromptAddon: `Notation: Swimlane — use flowchart TD with a subgraph per actor/department lane. Place steps inside the correct lane subgraph. Show handoffs across lanes with labeled edges.`,
  },
  {
    id: "flowchart",
    label: "Simple flowchart",
    shortDescription: "Boxes, diamonds, and arrows",
    chatPromptAddon: `Process notation: Simple flowchart — describe steps as sequential boxes and decisions as yes/no branches.`,
    diagramPromptAddon: `Notation: Simple flowchart — use flowchart TD. Rectangles for steps, diamonds for decisions, rounded boxes for start/end. Keep it minimal and readable.`,
  },
];

export function isProcessStandardId(value: string | null): value is ProcessStandardId {
  return PROCESS_STANDARD_IDS.includes(value as ProcessStandardId);
}

export function getProcessStandard(id: ProcessStandardId): ProcessStandard {
  return PROCESS_STANDARDS.find((s) => s.id === id) ?? PROCESS_STANDARDS[0];
}

export function getStoredProcessStandard(): ProcessStandardId {
  if (typeof window === "undefined") return DEFAULT_PROCESS_STANDARD;
  try {
    const stored = localStorage.getItem(STANDARD_STORAGE_KEY);
    if (isProcessStandardId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_PROCESS_STANDARD;
}

export function storeProcessStandard(id: ProcessStandardId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STANDARD_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

const STANDARD_TAG_RE = /^\[standard:([a-z-]+)\]\s*/;

export function parseProcessStandard(description: string): ProcessStandardId {
  const match = description.match(STANDARD_TAG_RE);
  if (match && isProcessStandardId(match[1])) return match[1];
  return DEFAULT_PROCESS_STANDARD;
}

export function formatStandardTag(id: ProcessStandardId): string {
  if (id === "auto") return "";
  return `[standard:${id}] `;
}

export function stripMetadataTags(description: string): string {
  return description
    .replace(/^\[template:[a-z-]+\]\s*/i, "")
    .replace(STANDARD_TAG_RE, "")
    .trim();
}

export function resolveProcessStandard(description: string): ProcessStandardId {
  return parseProcessStandard(description);
}