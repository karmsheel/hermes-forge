"use client";

import { useMemo } from "react";
import type { FunctionSummary } from "@/lib/functions";
import type { AnalyticsBusiness, AnalyticsProcess } from "@/components/functions/BusinessAnalyticsSection";
import { useRegisterPageContext } from "../useRegisterPageContext";

type Props = {
  business: AnalyticsBusiness | null;
  processes: AnalyticsProcess[];
  functions: FunctionSummary[];
};

/**
 * Registers Functions page context for hermes.forge.context.v1.
 */
export function FunctionsPageContext({ business, processes, functions }: Props) {
  const registration = useMemo(() => {
    if (!business) return null;
    const top = functions.slice(0, 10).map((f) => `${f.name} (${f.count})`);
    return {
      selection: {
        type: "functions",
        summary: `${functions.length} function(s), ${processes.length} process(es)`,
        details: {
          functionNames: functions.slice(0, 15).map((f) => f.name),
          processCount: processes.length,
        },
      },
      snapshotLines: [
        `Functions page for ${business.name}`,
        business.industry ? `Industry: ${business.industry}` : "",
        business.teamSize != null ? `Team size: ${business.teamSize}` : "",
        top.length ? `Departments: ${top.join("; ")}` : "No departments mapped yet",
      ].filter(Boolean),
    };
  }, [business, processes, functions]);

  useRegisterPageContext(registration);
  return null;
}
