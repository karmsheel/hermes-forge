export type WorkflowTemplateId =
  | "sop"
  | "customer-journey"
  | "approval-flow"
  | "onboarding"
  | "incident"
  | "blank";

export interface WorkflowTemplate {
  id: WorkflowTemplateId;
  title: string;
  description: string;
  seedPrompt: string;
  processName: string;
  /** Optional starter Mermaid diagram (e.g. SOP skeleton) */
  diagramMermaid?: string;
  /** Card art gradient stops */
  gradientFrom: string;
  gradientTo: string;
}

const SOP_STARTER_DIAGRAM = `flowchart TD
  Start([Start]) --> Define[Define procedure]
  Define --> Execute[Execute steps]
  Execute --> Review{Review OK?}
  Review -->|Yes| End([End])
  Review -->|No| Execute`;

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "sop",
    title: "SOP",
    description: "Standard operating procedures",
    processName: "Standard operating procedure",
    seedPrompt:
      "Map a standard operating procedure for our team. Include the trigger, each step in order, who owns each step, and how we know the process is complete.",
    diagramMermaid: SOP_STARTER_DIAGRAM,
    gradientFrom: "#c96442",
    gradientTo: "#8b3a28",
  },
  {
    id: "customer-journey",
    title: "Customer journey",
    description: "End-to-end customer flow",
    processName: "Customer journey",
    seedPrompt:
      "Map the end-to-end customer journey from first touch through purchase, onboarding, and renewal. Note key moments, handoffs, and pain points.",
    gradientFrom: "#2b6cb0",
    gradientTo: "#1a4070",
  },
  {
    id: "approval-flow",
    title: "Approval flow",
    description: "Sign-off chains",
    processName: "Approval workflow",
    seedPrompt:
      "Document an approval workflow: what gets submitted, who reviews at each stage, escalation rules, and final sign-off criteria.",
    gradientFrom: "#7c4dbd",
    gradientTo: "#4a2d78",
  },
  {
    id: "onboarding",
    title: "Onboarding",
    description: "New hire or customer onboarding",
    processName: "Onboarding process",
    seedPrompt:
      "Map our onboarding process from day zero through the first successful milestone. Include owners, tools used, and checkpoints.",
    gradientFrom: "#4a8f5c",
    gradientTo: "#2d5c3a",
  },
  {
    id: "incident",
    title: "Incident response",
    description: "Ops escalation",
    processName: "Incident response",
    seedPrompt:
      "Document our incident response flow: detection, triage, escalation paths, communication, resolution, and post-mortem.",
    gradientFrom: "#c44d7a",
    gradientTo: "#7a2f4c",
  },
  {
    id: "blank",
    title: "Blank process",
    description: "Start from scratch",
    processName: "Untitled Process",
    seedPrompt: "",
    gradientFrom: "#4a6278",
    gradientTo: "#2a3540",
  },
];

export function getWorkflowTemplate(id: WorkflowTemplateId): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}