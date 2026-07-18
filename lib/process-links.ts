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
    "To create links automatically, end your reply with a fenced JSON block tagged forge-links (the app applies it after your message):",
    "```forge-links",
    '[{"from":"Lead gen","to":"Fulfillment","label":"qualified orders"}]',
    "```",
    "Use exact process names that already exist (or seed them in the same turn with forge-drafts before forge-links).",
    "Users can also draw/delete links in Link mode on Foundation or the Map plant canvas.",
    "Do not invent links between processes that do not exist yet — seed draft processes first if needed.",
  ].join("\n");
}

// --- Server helpers (plant auto-apply) ---

export type CreateLinkByNameInput = {
  fromName: string;
  toName: string;
  label?: string | null;
  fromPort?: string | null;
  toPort?: string | null;
};

export type CreateLinksByNamesResult = {
  created: ProcessLinkDto[];
  skipped: Array<{ fromName: string; toName: string; reason: string }>;
  errors: Array<{ fromName: string; toName: string; error: string }>;
  createdCount: number;
};

/**
 * Create directed plant edges by process display name (case-insensitive).
 * Used by studio plant auto-apply (6.5).
 */
export async function createProcessLinksByNames(options: {
  businessId: string;
  userId: string;
  links: CreateLinkByNameInput[];
}): Promise<CreateLinksByNamesResult> {
  // Lazy import keeps this module importable from pure unit tests that only
  // need validation helpers — call sites are server routes / plant-apply.
  const { prisma } = await import("@/lib/prisma");
  const { liveOccurredNow, recordBusinessEvent } = await import(
    "@/lib/business-log"
  );
  const { BUSINESS_EVENT_TYPES } = await import("@/lib/business-log-types");

  const created: ProcessLinkDto[] = [];
  const skipped: CreateLinksByNamesResult["skipped"] = [];
  const errors: CreateLinksByNamesResult["errors"] = [];

  if (!options.links.length) {
    return { created, skipped, errors, createdCount: 0 };
  }

  const processes = await prisma.process.findMany({
    where: { businessId: options.businessId },
    select: { id: true, name: true, businessId: true },
  });
  const byName = new Map(
    processes.map((p) => [p.name.trim().toLowerCase(), p])
  );

  for (const link of options.links) {
    const fromName = link.fromName.trim();
    const toName = link.toName.trim();
    const fromProc = byName.get(fromName.toLowerCase());
    const toProc = byName.get(toName.toLowerCase());

    if (!fromProc || !toProc) {
      errors.push({
        fromName,
        toName,
        error: !fromProc
          ? `Unknown source process "${fromName}"`
          : `Unknown target process "${toName}"`,
      });
      continue;
    }

    const invalid = validateProcessLinkEndpoints({
      fromProcessId: fromProc.id,
      toProcessId: toProc.id,
      fromBusinessId: fromProc.businessId,
      toBusinessId: toProc.businessId,
      expectedBusinessId: options.businessId,
    });
    if (invalid) {
      errors.push({
        fromName,
        toName,
        error: linkValidationMessage(invalid),
      });
      continue;
    }

    const existing = await prisma.processLink.findUnique({
      where: {
        businessId_fromProcessId_toProcessId: {
          businessId: options.businessId,
          fromProcessId: fromProc.id,
          toProcessId: toProc.id,
        },
      },
    });
    if (existing) {
      skipped.push({
        fromName,
        toName,
        reason: "duplicate",
      });
      continue;
    }

    try {
      const row = await prisma.processLink.create({
        data: {
          businessId: options.businessId,
          fromProcessId: fromProc.id,
          toProcessId: toProc.id,
          label: link.label?.trim() || null,
          fromPort: link.fromPort?.trim() || null,
          toPort: link.toPort?.trim() || null,
        },
        include: {
          fromProcess: { select: { name: true } },
          toProcess: { select: { name: true } },
        },
      });

      await recordBusinessEvent({
        businessId: options.businessId,
        userId: options.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_LINK_CREATED,
        entityType: "process_link",
        entityId: row.id,
        entityName: `${fromProc.name} → ${toProc.name}`,
        summary: `Linked "${fromProc.name}" → "${toProc.name}" (plant apply)`,
        metadata: {
          preview: `plant_apply:${fromProc.name} → ${toProc.name}`,
        },
        ...liveOccurredNow(),
      });

      created.push(toProcessLinkDto(row));
    } catch (err) {
      errors.push({
        fromName,
        toName,
        error: err instanceof Error ? err.message : "Failed to create link",
      });
    }
  }

  return {
    created,
    skipped,
    errors,
    createdCount: created.length,
  };
}
