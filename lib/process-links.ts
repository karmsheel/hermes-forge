/**
 * Process-to-process plant edges (Phase 6.5).
 */

export type ProcessLinkDto = {
  id: string;
  businessId: string;
  fromProcessId: string;
  toProcessId: string;
  label: string | null;
  fromPort: string | null;
  toPort: string | null;
  createdAt: string;
  updatedAt: string;
  fromName?: string;
  toName?: string;
};

export type CreateProcessLinkInput = {
  fromProcessId: string;
  toProcessId: string;
  label?: string | null;
  fromPort?: string | null;
  toPort?: string | null;
};

export function toProcessLinkDto(row: {
  id: string;
  businessId: string;
  fromProcessId: string;
  toProcessId: string;
  label: string | null;
  fromPort: string | null;
  toPort: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  fromProcess?: { name: string } | null;
  toProcess?: { name: string } | null;
}): ProcessLinkDto {
  return {
    id: row.id,
    businessId: row.businessId,
    fromProcessId: row.fromProcessId,
    toProcessId: row.toProcessId,
    label: row.label,
    fromPort: row.fromPort,
    toPort: row.toPort,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : row.createdAt.toISOString(),
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : row.updatedAt.toISOString(),
    fromName: row.fromProcess?.name,
    toName: row.toProcess?.name,
  };
}

export type LinkValidationError =
  | "same_process"
  | "missing_from"
  | "missing_to"
  | "cross_business"
  | "duplicate";

/**
 * Validate a directed link within one business.
 * Caller supplies process rows already scoped to the business when possible.
 */
export function validateProcessLinkEndpoints(input: {
  fromProcessId: string;
  toProcessId: string;
  fromBusinessId?: string | null;
  toBusinessId?: string | null;
  expectedBusinessId: string;
}): LinkValidationError | null {
  if (!input.fromProcessId || !input.toProcessId) {
    return !input.fromProcessId ? "missing_from" : "missing_to";
  }
  if (input.fromProcessId === input.toProcessId) {
    return "same_process";
  }
  if (
    input.fromBusinessId != null &&
    input.fromBusinessId !== input.expectedBusinessId
  ) {
    return "cross_business";
  }
  if (
    input.toBusinessId != null &&
    input.toBusinessId !== input.expectedBusinessId
  ) {
    return "cross_business";
  }
  return null;
}

export function linkValidationMessage(code: LinkValidationError): string {
  switch (code) {
    case "same_process":
      return "A process cannot link to itself";
    case "missing_from":
      return "Source process is required";
    case "missing_to":
      return "Target process is required";
    case "cross_business":
      return "Links must stay within the same business";
    case "duplicate":
      return "That link already exists";
    default:
      return "Invalid link";
  }
}

/** Studio / Foundation guidance for plant edges. */
export function processLinksPromptAddon(): string {
  return [
    "Plant links (process-to-process edges): work can flow from one process block to another.",
    "When the user describes handoffs (e.g. “fulfillment feeds invoicing”), name the source and target process clearly.",
    "They can create/delete links on Foundation or God Mode (link mode: click source, then target).",
    "Do not invent links between processes that do not exist yet — propose draft processes first if needed.",
  ].join("\n");
}
