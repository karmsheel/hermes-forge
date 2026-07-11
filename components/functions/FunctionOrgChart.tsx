"use client";

import type { MouseEvent } from "react";
import { Building2 } from "lucide-react";
import type { FunctionSummary } from "@/lib/functions";

interface FunctionOrgChartProps {
  businessName: string;
  functions: FunctionSummary[];
  onSelectFunction: (functionName: string, event?: MouseEvent) => void;
}

export function FunctionOrgChart({
  businessName,
  functions,
  onSelectFunction,
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
            {functions.map((fn) => (
              <li key={fn.name} className="function-org-chart__child">
                <div className="function-org-chart__child-stem" aria-hidden />
                <button
                  type="button"
                  className="function-org-chart__node function-org-chart__node--function"
                  title="Open in workshop · Ctrl+click for new tab"
                  onClick={(e) => onSelectFunction(fn.name, e)}
                >
                  <span className="function-org-chart__function-name">{fn.name}</span>
                  <span className="function-org-chart__function-count">
                    {fn.count} workflow{fn.count !== 1 ? "s" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}