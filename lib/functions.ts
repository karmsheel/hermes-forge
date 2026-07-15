import type { ProcessSummary } from "./types";

export const ALL_FUNCTIONS_VALUE = "__all__";

/** Common function suggestions for the New Function dialog. */
export const SUGGESTED_FUNCTION_NAMES = [
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
  "Support",
  "HR",
  "Product",
  "Engineering",
  "Legal",
  "Customer Success",
] as const;

export type FunctionSummary = {
  name: string;
  count: number;
};

export type DeclaredFunction = {
  name: string;
  description?: string | null;
};

export function normalizeDepartment(department: string | null | undefined): string {
  const trimmed = (department || "").trim();
  return trimmed || "Uncategorized";
}

/**
 * Merge declared business functions with departments found on processes.
 * Declared empty functions (count 0) still appear on the org chart.
 */
export function aggregateFunctions(
  processes: ProcessSummary[],
  declared: Array<string | DeclaredFunction> = [],
): FunctionSummary[] {
  const map = new Map<string, number>();

  for (const entry of declared) {
    const name = normalizeDepartment(typeof entry === "string" ? entry : entry.name);
    if (!map.has(name)) map.set(name, 0);
  }

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

/**
 * Heuristic “detect” suggestions from business industry / description.
 * Returns names not already present on the map.
 */
export function detectFunctionSuggestions(options: {
  industry?: string | null;
  description?: string | null;
  goals?: string | null;
  existing: string[];
}): string[] {
  const text = [options.industry, options.description, options.goals]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const existing = new Set(
    options.existing.map((n) => normalizeDepartment(n).toLowerCase()),
  );

  const scored: { name: string; score: number }[] = [];

  const rules: { name: string; keywords: string[] }[] = [
    { name: "Sales", keywords: ["sales", "revenue", "pipeline", "crm", "b2b", "b2c"] },
    { name: "Marketing", keywords: ["marketing", "brand", "content", "seo", "ads", "growth"] },
    { name: "Operations", keywords: ["operations", "ops", "fulfillment", "logistics", "supply"] },
    { name: "Finance", keywords: ["finance", "accounting", "billing", "invoice", "payroll"] },
    { name: "Support", keywords: ["support", "helpdesk", "customer service", "ticket"] },
    { name: "HR", keywords: ["hr", "people", "recruit", "hiring", "talent"] },
    { name: "Product", keywords: ["product", "roadmap", "feature", "saas"] },
    { name: "Engineering", keywords: ["engineering", "software", "dev", "tech", "platform"] },
    { name: "Legal", keywords: ["legal", "compliance", "contract", "privacy"] },
    {
      name: "Customer Success",
      keywords: ["customer success", "onboarding", "retention", "churn"],
    },
  ];

  for (const rule of rules) {
    if (existing.has(rule.name.toLowerCase())) continue;
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > 0) scored.push({ name: rule.name, score });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (scored.length > 0) {
    return scored.slice(0, 5).map((s) => s.name);
  }

  // Fallback defaults when nothing matched
  return SUGGESTED_FUNCTION_NAMES.filter((n) => !existing.has(n.toLowerCase())).slice(0, 5);
}
