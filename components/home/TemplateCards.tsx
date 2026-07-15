"use client";

import type { WorkflowTemplate, WorkflowTemplateId } from "@/lib/workflow-templates";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";

interface TemplateCardsProps {
  selectedId: WorkflowTemplateId | null;
  onSelect: (template: WorkflowTemplate) => void;
  onClear?: () => void;
}

export function TemplateCards({ selectedId, onSelect, onClear }: TemplateCardsProps) {
  return (
    <div className="home-templates">
      <div className="home-templates__label">Start from a template</div>
      <div className="home-templates__pills" role="list">
        {WORKFLOW_TEMPLATES.map((template) => {
          const active = selectedId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              role="listitem"
              className={`home-template-pill${active ? " is-active" : ""}`}
              onClick={() => {
                if (active) {
                  onClear?.();
                } else {
                  onSelect(template);
                }
              }}
              aria-pressed={active}
            >
              {template.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
