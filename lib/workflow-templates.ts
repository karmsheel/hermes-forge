/**
 * Workflow template library (backlog 4.1 / 6.7).
 * Curated templates live as JSON under `templates/workflows/`.
 * Home / Foundation starters seed **Foundation drafts** (not workshop-first processes).
 */

import type { SeedDraftInput } from "@/lib/foundation";
import approvalFlow from "@/templates/workflows/approval-flow.json" with { type: "json" };
import contentOps from "@/templates/workflows/content-ops.json" with { type: "json" };
import customerJourney from "@/templates/workflows/customer-journey.json" with { type: "json" };
import incident from "@/templates/workflows/incident.json" with { type: "json" };
import onboarding from "@/templates/workflows/onboarding.json" with { type: "json" };
import sop from "@/templates/workflows/sop.json" with { type: "json" };

export type WorkflowTemplateId =
  | "sop"
  | "customer-journey"
  | "approval-flow"
  | "onboarding"
  | "incident"
  | "content-ops";

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

function asTemplate(raw: {
  id: string;
  title: string;
  description: string;
  seedPrompt: string;
  processName: string;
  diagramMermaid?: string;
  gradientFrom: string;
  gradientTo: string;
}): WorkflowTemplate {
  return {
    id: raw.id as WorkflowTemplateId,
    title: raw.title,
    description: raw.description,
    seedPrompt: raw.seedPrompt,
    processName: raw.processName,
    diagramMermaid: raw.diagramMermaid,
    gradientFrom: raw.gradientFrom,
    gradientTo: raw.gradientTo,
  };
}

/** Ordered catalog loaded from `templates/workflows/*.json`. */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  asTemplate(contentOps),
  asTemplate(sop),
  asTemplate(customerJourney),
  asTemplate(approvalFlow),
  asTemplate(onboarding),
  asTemplate(incident),
];

export const WORKFLOW_TEMPLATE_IDS = WORKFLOW_TEMPLATES.map((t) => t.id) as WorkflowTemplateId[];

export function getWorkflowTemplate(id: WorkflowTemplateId): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

export function isWorkflowTemplateId(value: string | null | undefined): value is WorkflowTemplateId {
  return Boolean(value && WORKFLOW_TEMPLATE_IDS.includes(value as WorkflowTemplateId));
}

/**
 * Map a curated workflow template to Foundation draft seed input(s) (6.7).
 * One primary draft per template today; array keeps multi-block templates open.
 */
export function templateToFoundationDrafts(
  template: WorkflowTemplate
): SeedDraftInput[] {
  const description = [
    template.description?.trim(),
    template.seedPrompt?.trim()
      ? `Starter brief: ${template.seedPrompt.trim().slice(0, 800)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      name: template.processName.trim() || template.title,
      description,
      diagramMermaid: template.diagramMermaid?.trim() || null,
    },
  ];
}
