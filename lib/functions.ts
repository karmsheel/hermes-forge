import type { ProcessSummary } from "./types";

export const ALL_FUNCTIONS_VALUE = "__all__";

export type FunctionSummary = {
  name: string;
  count: number;
};

export function normalizeDepartment(department: string | null | undefined): string {
  const trimmed = (department || "").trim();
  return trimmed || "Uncategorized";
}

export function aggregateFunctions(processes: ProcessSummary[]): FunctionSummary[] {
  const map = new Map<string, number>();
  for (const process of processes) {
    const name = normalizeDepartment(process.department);
    map.set(name, (map.get(name) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterProcessesByFunction(
  processes: ProcessSummary[],
  functionFilter: string | null,
): ProcessSummary[] {
  if (!functionFilter || functionFilter === ALL_FUNCTIONS_VALUE) {
    return processes;
  }

  return processes.filter(
    (process) => normalizeDepartment(process.department) === functionFilter,
  );
}

export function filterProcessesByFunctionKeepingActive(
  processes: ProcessSummary[],
  functionFilter: string | null,
  activeId: string | null,
): ProcessSummary[] {
  const filtered = filterProcessesByFunction(processes, functionFilter);
  if (!activeId || filtered.some((process) => process.id === activeId)) {
    return filtered;
  }

  const active = processes.find((process) => process.id === activeId);
  return active ? [active, ...filtered] : filtered;
}