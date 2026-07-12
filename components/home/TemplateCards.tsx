"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Newspaper,
  Route,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getTemplateCardArtStyle } from "@/lib/home/project-card-thumb";
import type { WorkflowTemplate, WorkflowTemplateId } from "@/lib/workflow-templates";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";

const TEMPLATE_ICONS: Record<WorkflowTemplateId, LucideIcon> = {
  "content-ops": Newspaper,
  sop: ClipboardList,
  "customer-journey": Route,
  "approval-flow": CheckCircle2,
  onboarding: UserPlus,
  incident: AlertTriangle,
};

interface TemplateCardsProps {
  selectedId: WorkflowTemplateId | null;
  onSelect: (template: WorkflowTemplate) => void;
}

export function TemplateCards({ selectedId, onSelect }: TemplateCardsProps) {
  const { skin, resolved } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Auto-reveal when a template is selected (e.g. user picked one or pre-filled)
  useEffect(() => {
    if (selectedId) {
      setExpanded(true);
    }
  }, [selectedId]);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("homeTemplatesExpanded", String(next));
    }
  }

  // On mount, restore user preference (but selectedId effect above will override if active)
  useEffect(() => {
    if (typeof window !== "undefined" && !selectedId) {
      const saved = localStorage.getItem("homeTemplatesExpanded");
      if (saved === "true") setExpanded(true);
    }
  }, [selectedId]);

  return (
    <div className="home-templates">
      <button
        type="button"
        onClick={toggleExpanded}
        className="home-templates__toggle"
        aria-expanded={expanded}
      >
        Start from a template
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {expanded && (
        <div className="home-templates__scroll" role="list">
          {WORKFLOW_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.id];
            const active = selectedId === template.id;

            return (
              <button
                key={template.id}
                type="button"
                role="listitem"
                className={`home-template-card${active ? " is-active" : ""}`}
                onClick={() => onSelect(template)}
                aria-pressed={active}
              >
                <div
                  className="home-template-card__art"
                  style={getTemplateCardArtStyle(
                    template.id,
                    skin,
                    resolved,
                    template.gradientFrom,
                    template.gradientTo,
                  )}
                  aria-hidden
                >
                  <Icon className="home-template-card__icon" />
                </div>
                <div className="home-template-card__body">
                  <span className="home-template-card__title">{template.title}</span>
                  <span className="home-template-card__desc">{template.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}