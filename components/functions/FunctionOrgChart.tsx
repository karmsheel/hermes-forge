"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building2, ChevronDown, MoreHorizontal } from "lucide-react";
import type { FunctionSummary } from "@/lib/functions";
import { normalizeDepartment } from "@/lib/functions";

export type FunctionWorkflow = {
  id: string;
  name: string;
  department: string;
  status?: string | null;
};

interface FunctionOrgChartProps {
  businessName: string;
  functions: FunctionSummary[];
  workflows: FunctionWorkflow[];
  expandedFunction: string | null;
  onToggleFunction: (functionName: string) => void;
  onMoveWorkflow: (processId: string, toFunction: string) => void;
  movingProcessId?: string | null;
}

export function FunctionOrgChart({
  businessName,
  functions,
  workflows,
  expandedFunction,
  onToggleFunction,
  onMoveWorkflow,
  movingProcessId = null,
}: FunctionOrgChartProps) {
  return (
    <div className="function-org-chart" aria-label={`Organization chart for ${businessName}`}>
      <div className="function-org-chart__root">
        <div className="function-org-chart__node function-org-chart__node--business">
          <Building2 className="function-org-chart__icon" aria-hidden />
          <span className="function-org-chart__label">{businessName}</span>
        </div>
      </div>

      {functions.length > 0 && (
        <div className="function-org-chart__tree">
          <div className="function-org-chart__stem" aria-hidden />
          <ul className="function-org-chart__children">
            {functions.map((fn) => {
              const isExpanded = expandedFunction === fn.name;
              const fnWorkflows = workflows.filter(
                (w) => normalizeDepartment(w.department) === fn.name,
              );
              const otherFunctions = functions
                .map((f) => f.name)
                .filter((n) => n !== fn.name);

              return (
                <li
                  key={fn.name}
                  className={`function-org-chart__child${isExpanded ? " is-expanded" : ""}`}
                >
                  <div className="function-org-chart__child-stem" aria-hidden />
                  <button
                    type="button"
                    className={`function-org-chart__node function-org-chart__node--function${
                      isExpanded ? " is-expanded" : ""
                    }`}
                    aria-expanded={isExpanded}
                    title={isExpanded ? "Collapse workflows" : "Show workflows in this function"}
                    onClick={() => onToggleFunction(fn.name)}
                  >
                    <span className="function-org-chart__function-name">{fn.name}</span>
                    <span className="function-org-chart__function-count">
                      {fn.count} workflow{fn.count !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown
                      className={`function-org-chart__chevron${isExpanded ? " is-open" : ""}`}
                      aria-hidden
                    />
                  </button>

                  {isExpanded ? (
                    <div className="function-org-chart__workflows" role="region" aria-label={`${fn.name} workflows`}>
                      {fnWorkflows.length === 0 ? (
                        <p className="function-org-chart__workflows-empty">
                          No workflows yet. Move a process here from another function, or map one in
                          Workshop with this department.
                        </p>
                      ) : (
                        <ul className="function-org-chart__workflow-list">
                          {fnWorkflows.map((wf) => (
                            <li key={wf.id} className="function-org-chart__workflow-item">
                              <div className="function-org-chart__workflow-main">
                                <span className="function-org-chart__workflow-name">{wf.name}</span>
                                {wf.status ? (
                                  <span className="function-org-chart__workflow-status">
                                    {wf.status}
                                  </span>
                                ) : null}
                              </div>
                              <MoveWorkflowMenu
                                processName={wf.name}
                                targets={otherFunctions}
                                disabled={movingProcessId === wf.id || otherFunctions.length === 0}
                                busy={movingProcessId === wf.id}
                                onMove={(to) => onMoveWorkflow(wf.id, to)}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function MoveWorkflowMenu({
  processName,
  targets,
  disabled,
  busy,
  onMove,
}: {
  processName: string;
  targets: string[];
  disabled: boolean;
  busy: boolean;
  onMove: (toFunction: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="function-org-chart__move" ref={rootRef}>
      <button
        type="button"
        className="function-org-chart__move-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Move “${processName}” to another function`}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
        <span className="function-org-chart__move-label">{busy ? "Moving…" : "Move"}</span>
      </button>
      {open ? (
        <ul id={menuId} className="function-org-chart__move-menu" role="menu">
          {targets.length === 0 ? (
            <li className="function-org-chart__move-empty" role="none">
              No other functions yet
            </li>
          ) : (
            targets.map((target) => (
              <li key={target} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="function-org-chart__move-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onMove(target);
                  }}
                >
                  {target}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
