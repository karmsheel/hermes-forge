export const HOME_PROMPT_EXAMPLES = [
  "Map how leads become paying customers in our sales pipeline",
  "Document our employee onboarding from offer letter to first day",
  "Trace the invoice approval chain from submission to payment",
  "Describe our customer support ticket escalation process",
  "Map the manufacturing handoff from order to shipment",
] as const;

export function deriveProjectName(brief: string): string {
  const line = brief.trim().split("\n")[0]?.trim() ?? "";
  if (!line) return "Untitled Function";

  const candidate =
    line.length > 60 ? (line.split(/[,.\n]/)[0]?.trim() || line) : line;
  if (candidate.length <= 60) return candidate;
  return `${candidate.slice(0, 57).trim()}…`;
}