"use client";

import { FileText, GitBranch, HelpCircle, Code2, Download } from "lucide-react";

export type WorkspaceTab = "diagram" | "details" | "questions" | "source" | "export";

interface WorkspaceTabsProps {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  hasDiagram: boolean;
  hasProcess: boolean;
}

const TABS: { id: WorkspaceTab; label: string; icon: typeof FileText }[] = [
  { id: "diagram", label: "Diagram", icon: GitBranch },
  { id: "details", label: "Details", icon: FileText },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "source", label: "Source", icon: Code2 },
  { id: "export", label: "Export", icon: Download },
];

export function WorkspaceTabs({ active, onChange, hasDiagram, hasProcess }: WorkspaceTabsProps) {
  if (!hasProcess) return null;

  return (
    <div className="flex items-center gap-0.5 px-4 border-b border-border bg-bg-panel shrink-0">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        const isDisabled = tab.id === "source" && !hasDiagram;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !isDisabled && onChange(tab.id)}
            disabled={isDisabled}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              isActive
                ? "border-accent text-text"
                : isDisabled
                  ? "border-transparent text-text-faint cursor-not-allowed"
                  : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
