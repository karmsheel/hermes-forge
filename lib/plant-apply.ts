/**
 * Plant auto-apply from Hermes studio chat (Phase 6.2 / 6.5).
 *
 * Hermes emits structured fences in assistant text; the server applies them
 * after the stream finishes (no separate OpenAI tools round-trip required).
 *
 * Fences:
 * - ```forge-drafts``` — seed/upsert Foundation draft processes
 * - ```forge-docs``` — upsert knowledge documents (or propose if forged)
 * - ```forge-links``` — create process-to-process plant edges by name
 */

import { parseJsonFromLlm } from "@/lib/hermes";
import { parseForgeDraftsFence } from "@/lib/foundation-extract";
import { seedFoundationDrafts } from "@/lib/foundation-seed";
import {
  createProcessLinksByNames,
  type CreateLinkByNameInput,
  type CreateLinksByNamesResult,
} from "@/lib/process-links";
import {
  allocateDocumentSlug,
  ensureBusinessDocuments,
  isDocumentKind,
  type DocumentKind,
} from "@/lib/documents";
import { liveOccurredNow, recordBusinessEvent, truncatePreview } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import { prisma } from "@/lib/prisma";
import type { FoundationProcessCard } from "@/lib/foundation";

export const FORGE_LINKS_FENCE = "forge-links";
export const FORGE_DOCS_FENCE = "forge-docs";

export type PlantDocInput = {
  /** Prefer matching seeded kinds by slug (basics, market, …). */
  slug?: string | null;
  title?: string | null;
  kind?: DocumentKind | string | null;
  bodyMarkdown: string;
  /** replace (default) or append to existing body */
  mode?: "replace" | "append";
  pinnedForContext?: boolean;
};

export type PlantApplyDraftsResult = {
  created: FoundationProcessCard[];
  updated: FoundationProcessCard[];
  skipped: string[];
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

export type PlantApplyDocResult = {
  id: string;
  title: string;
  slug: string;
  action: "created" | "updated" | "proposed" | "skipped";
  reason?: string;
};

export type PlantApplyResult = {
  applied: boolean;
  drafts: PlantApplyDraftsResult | null;
  documents: PlantApplyDocResult[];
  links: CreateLinksByNamesResult | null;
  errors: string[];
};

const LINKS_FENCE_RE = /```forge-links\s*\n([\s\S]*?)```/gi;
const DOCS_FENCE_RE = /```forge-docs\s*\n([\s\S]*?)```/gi;

/** Routes where plant fences are auto-applied after studio chat. */
export function shouldAutoApplyPlant(route: string | null | undefined): boolean {
  const r = (route || "").split("?")[0] || "";
  return (
    r.startsWith("/foundation") ||
    r.startsWith("/god-mode") ||
    r.startsWith("/documents") ||
    r === "/home" ||
    r === "/map/home" ||
    r === "/monitor/home" ||
    r === "/automate/home" ||
    r === "/"
  );
}

export function hasPlantApplyFences(text: string | null | undefined): boolean {
  if (!text) return false;
  return (
    /```forge-drafts/i.test(text) ||
    /```forge-links/i.test(text) ||
    /```forge-docs/i.test(text)
  );
}

export function parseForgeLinksFence(
  text: string | null | undefined
): CreateLinkByNameInput[] {
  if (!text?.trim()) return [];
  const collected: CreateLinkByNameInput[] = [];
  const re = new RegExp(LINKS_FENCE_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      collected.push(...coerceLinkArray(parsed));
    } catch {
      try {
        const parsed = parseJsonFromLlm(body);
        collected.push(...coerceLinkArray(parsed));
      } catch {
        /* skip */
      }
    }
  }
  return dedupeLinks(collected);
}

export function parseForgeDocsFence(
  text: string | null | undefined
): PlantDocInput[] {
  if (!text?.trim()) return [];
  const collected: PlantDocInput[] = [];
  const re = new RegExp(DOCS_FENCE_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      collected.push(...coerceDocArray(parsed));
    } catch {
      try {
        const parsed = parseJsonFromLlm(body);
        collected.push(...coerceDocArray(parsed));
      } catch {
        /* skip */
      }
    }
  }
  return collected;
}

function coerceLinkArray(raw: unknown): CreateLinkByNameInput[] {
  if (Array.isArray(raw)) {
    return raw
      .map(itemToLink)
      .filter((x): x is CreateLinkByNameInput => Boolean(x));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.links)) {
      return obj.links
        .map(itemToLink)
        .filter((x): x is CreateLinkByNameInput => Boolean(x));
    }
    const one = itemToLink(raw);
    return one ? [one] : [];
  }
  return [];
}

function itemToLink(item: unknown): CreateLinkByNameInput | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const from =
    (typeof row.from === "string" && row.from.trim()) ||
    (typeof row.fromName === "string" && row.fromName.trim()) ||
    (typeof row.source === "string" && row.source.trim()) ||
    "";
  const to =
    (typeof row.to === "string" && row.to.trim()) ||
    (typeof row.toName === "string" && row.toName.trim()) ||
    (typeof row.target === "string" && row.target.trim()) ||
    "";
  if (!from || !to) return null;
  return {
    fromName: from.slice(0, 200),
    toName: to.slice(0, 200),
    label:
      typeof row.label === "string"
        ? row.label.trim().slice(0, 200) || null
        : null,
    fromPort:
      typeof row.fromPort === "string"
        ? row.fromPort.trim().slice(0, 80) || null
        : null,
    toPort:
      typeof row.toPort === "string"
        ? row.toPort.trim().slice(0, 80) || null
        : null,
  };
}

function dedupeLinks(links: CreateLinkByNameInput[]): CreateLinkByNameInput[] {
  const seen = new Set<string>();
  const out: CreateLinkByNameInput[] = [];
  for (const l of links) {
    const key = `${l.fromName.toLowerCase()}→${l.toName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

function coerceDocArray(raw: unknown): PlantDocInput[] {
  if (Array.isArray(raw)) {
    return raw.map(itemToDoc).filter((x): x is PlantDocInput => Boolean(x));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.documents) || Array.isArray(obj.docs)) {
      const list = (obj.documents || obj.docs) as unknown[];
      return list.map(itemToDoc).filter((x): x is PlantDocInput => Boolean(x));
    }
    const one = itemToDoc(raw);
    return one ? [one] : [];
  }
  return [];
}

function itemToDoc(item: unknown): PlantDocInput | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const body =
    typeof row.bodyMarkdown === "string"
      ? row.bodyMarkdown
      : typeof row.body === "string"
        ? row.body
        : typeof row.content === "string"
          ? row.content
          : "";
  if (!body.trim()) return null;
  const mode =
    row.mode === "append" || row.mode === "replace" ? row.mode : "replace";
  return {
    slug: typeof row.slug === "string" ? row.slug.trim().slice(0, 80) : null,
    title: typeof row.title === "string" ? row.title.trim().slice(0, 200) : null,
    kind: typeof row.kind === "string" ? row.kind.trim() : null,
    bodyMarkdown: body.slice(0, 200_000),
    mode,
    pinnedForContext:
      typeof row.pinnedForContext === "boolean"
        ? row.pinnedForContext
        : undefined,
  };
}

/**
 * Apply plant fences from assistant text. Order: drafts → docs → links
 * so links can target processes just seeded in the same turn.
 */
export async function applyPlantFromAssistantText(options: {
  businessId: string;
  userId: string;
  assistantText: string;
  conversationId?: string | null;
  hermesAgentProfileId?: string | null;
}): Promise<PlantApplyResult> {
  const errors: string[] = [];
  const text = options.assistantText || "";

  const draftInputs = parseForgeDraftsFence(text);
  const docInputs = parseForgeDocsFence(text);
  const linkInputs = parseForgeLinksFence(text);

  if (
    draftInputs.length === 0 &&
    docInputs.length === 0 &&
    linkInputs.length === 0
  ) {
    return {
      applied: false,
      drafts: null,
      documents: [],
      links: null,
      errors: [],
    };
  }

  let drafts: PlantApplyDraftsResult | null = null;
  if (draftInputs.length > 0) {
    try {
      const result = await seedFoundationDrafts({
        businessId: options.businessId,
        userId: options.userId,
        drafts: draftInputs,
        mode: "upsert",
      });
      drafts = result;
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Failed to seed draft processes"
      );
    }
  }

  const documents: PlantApplyDocResult[] = [];
  if (docInputs.length > 0) {
    try {
      await ensureBusinessDocuments(options.businessId, prisma);
    } catch {
      /* non-fatal */
    }
    for (const doc of docInputs) {
      try {
        const row = await upsertDocumentFromPlant({
          businessId: options.businessId,
          userId: options.userId,
          input: doc,
          conversationId: options.conversationId,
          hermesAgentProfileId: options.hermesAgentProfileId,
        });
        documents.push(row);
      } catch (err) {
        errors.push(
          err instanceof Error
            ? err.message
            : `Failed to upsert document ${doc.slug || doc.title || "?"}`
        );
      }
    }
  }

  let links: CreateLinksByNamesResult | null = null;
  if (linkInputs.length > 0) {
    try {
      links = await createProcessLinksByNames({
        businessId: options.businessId,
        userId: options.userId,
        links: linkInputs,
      });
      if (links.errors.length) {
        errors.push(...links.errors.map((e) => e.error));
      }
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Failed to create process links"
      );
    }
  }

  return {
    applied: true,
    drafts,
    documents,
    links,
    errors,
  };
}

async function upsertDocumentFromPlant(options: {
  businessId: string;
  userId: string;
  input: PlantDocInput;
  conversationId?: string | null;
  hermesAgentProfileId?: string | null;
}): Promise<PlantApplyDocResult> {
  const { input } = options;
  const slugHint = input.slug?.trim().toLowerCase() || null;
  const titleHint = input.title?.trim() || null;

  let match =
    slugHint || titleHint
      ? await prisma.businessDocument.findFirst({
          where: {
            businessId: options.businessId,
            OR: [
              ...(slugHint ? [{ slug: slugHint }] : []),
              ...(titleHint ? [{ title: titleHint }] : []),
            ],
          },
        })
      : null;

  // Case-insensitive title / slug fallback (SQLite equality is case-sensitive)
  if (!match && (titleHint || slugHint)) {
    const all = await prisma.businessDocument.findMany({
      where: { businessId: options.businessId },
    });
    const hit =
      (slugHint
        ? all.find((d) => d.slug.toLowerCase() === slugHint.toLowerCase())
        : undefined) ??
      (titleHint
        ? all.find((d) => d.title.toLowerCase() === titleHint.toLowerCase())
        : undefined);
    match = hit ?? null;
  }

  if (match) {
    if (match.lifecycleStatus === "forged") {
      try {
        const { proposeForgedDocumentPatch } = await import(
          "@/lib/decisions/propose"
        );
        await proposeForgedDocumentPatch({
          businessId: options.businessId,
          userId: options.userId,
          documentId: match.id,
          documentTitle: match.title,
          lifecycleStatus: match.lifecycleStatus,
          patch: {
            title: titleHint || undefined,
            bodyMarkdown:
              input.mode === "append"
                ? `${match.bodyMarkdown.trim()}\n\n${input.bodyMarkdown.trim()}`
                : input.bodyMarkdown,
            kind: isDocumentKind(String(input.kind || ""))
              ? (input.kind as DocumentKind)
              : undefined,
            pinnedForContext: input.pinnedForContext,
          },
          conversationId: options.conversationId ?? null,
          hermesAgentProfileId: options.hermesAgentProfileId ?? null,
        });
        return {
          id: match.id,
          title: match.title,
          slug: match.slug,
          action: "proposed",
          reason: "Document is forged — change proposed for owner review",
        };
      } catch (err) {
        return {
          id: match.id,
          title: match.title,
          slug: match.slug,
          action: "skipped",
          reason:
            err instanceof Error
              ? err.message
              : "Could not propose forged document patch",
        };
      }
    }

    const nextBody =
      input.mode === "append"
        ? `${match.bodyMarkdown.trim()}\n\n${input.bodyMarkdown.trim()}`
        : input.bodyMarkdown;

    const kind =
      input.kind && isDocumentKind(String(input.kind))
        ? (input.kind as DocumentKind)
        : undefined;

    const updated = await prisma.businessDocument.update({
      where: { id: match.id },
      data: {
        bodyMarkdown: nextBody,
        ...(titleHint && match.slug !== "basics" ? { title: titleHint } : {}),
        ...(kind ? { kind } : {}),
        ...(typeof input.pinnedForContext === "boolean"
          ? { pinnedForContext: input.pinnedForContext }
          : {}),
        source: "hermes",
      },
    });

    await recordBusinessEvent({
      businessId: options.businessId,
      userId: options.userId,
      type: BUSINESS_EVENT_TYPES.DOCUMENT_UPDATED,
      entityType: "document",
      entityId: updated.id,
      entityName: updated.title,
      summary: `Hermes updated document "${updated.title}" (plant apply)`,
      metadata: {
        preview: truncatePreview(`plant_apply:${nextBody}`, 120),
        documentSlug: updated.slug,
        documentKind: updated.kind,
      },
      ...liveOccurredNow(),
    });

    return {
      id: updated.id,
      title: updated.title,
      slug: updated.slug,
      action: "updated",
    };
  }

  const title = titleHint || slugHint || "Note from Hermes";
  const kind: DocumentKind =
    input.kind && isDocumentKind(String(input.kind))
      ? (input.kind as DocumentKind)
      : "freeform";
  const slug = await allocateDocumentSlug(
    options.businessId,
    slugHint || title,
    prisma
  );

  const created = await prisma.businessDocument.create({
    data: {
      businessId: options.businessId,
      title,
      kind,
      slug,
      bodyMarkdown: input.bodyMarkdown,
      pinnedForContext: input.pinnedForContext ?? false,
      sortOrder: 100,
      source: "hermes",
    },
  });

  await recordBusinessEvent({
    businessId: options.businessId,
    userId: options.userId,
    type: BUSINESS_EVENT_TYPES.DOCUMENT_CREATED,
    entityType: "document",
    entityId: created.id,
    entityName: created.title,
    summary: `Hermes created document "${created.title}" (plant apply)`,
    metadata: {
      preview: truncatePreview(`plant_apply:${input.bodyMarkdown}`, 120),
      documentSlug: created.slug,
      documentKind: created.kind,
    },
    ...liveOccurredNow(),
  });

  return {
    id: created.id,
    title: created.title,
    slug: created.slug,
    action: "created",
  };
}

/** Compact summary for SSE / toast. */
export function summarizePlantApply(result: PlantApplyResult): string {
  if (!result.applied) return "";
  const parts: string[] = [];
  if (result.drafts) {
    const n =
      (result.drafts.createdCount || 0) + (result.drafts.updatedCount || 0);
    if (n > 0) {
      parts.push(
        `${n} draft process${n === 1 ? "" : "es"}`
      );
    }
  }
  const docApplied = result.documents.filter(
    (d) => d.action === "created" || d.action === "updated"
  ).length;
  const docProposed = result.documents.filter(
    (d) => d.action === "proposed"
  ).length;
  if (docApplied > 0) {
    parts.push(`${docApplied} document${docApplied === 1 ? "" : "s"}`);
  }
  if (docProposed > 0) {
    parts.push(
      `${docProposed} document decision${docProposed === 1 ? "" : "s"}`
    );
  }
  if (result.links && result.links.createdCount > 0) {
    parts.push(
      `${result.links.createdCount} link${result.links.createdCount === 1 ? "" : "s"}`
    );
  }
  if (parts.length === 0 && result.errors.length > 0) {
    return "Plant apply had errors";
  }
  if (parts.length === 0) return "Plant data unchanged";
  return `Applied: ${parts.join(", ")}`;
}

/** Browser event: chatbar / studio → Foundation + Map refresh. */
export const PLANT_APPLIED_EVENT = "forge:plant-applied";

export type PlantAppliedEventDetail = {
  result: PlantApplyResult;
  conversationId?: string | null;
  assistantMessageId?: string | null;
  summary?: string;
};

export function dispatchPlantApplied(detail: PlantAppliedEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLANT_APPLIED_EVENT, { detail }));
}
