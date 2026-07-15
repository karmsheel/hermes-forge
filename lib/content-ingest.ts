import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  CONTENT_CHANNELS,
  CONTENT_STATUSES,
  isContentChannel,
  isContentStatus,
  type ContentChannel,
  type ContentStatus,
} from "@/lib/content-types";

export type ContentIngestInput = {
  title: string;
  bodyMarkdown?: string;
  status?: string | null;
  channel?: string | null;
  /** Defaults to hermes for token ingest; session simulate may pass hermes too. */
  source?: "hermes" | "manual" | "import";
};

export type ContentIngestContext = {
  automationId: string;
  processId: string;
  businessId: string;
  processName: string;
  /** Business owner user id (for notifications). */
  ownerUserId: string;
  /** Actor for business log (owner or null for agent callback). */
  logUserId?: string | null;
};

export function generateIngestToken(): string {
  return `forge-ingest-${randomBytes(24).toString("base64url")}`;
}

export function normalizeIngestTitle(raw: string): string {
  const t = raw.trim().slice(0, 300);
  return t || "Untitled draft";
}

export function resolveIngestStatus(raw?: string | null): ContentStatus {
  if (isContentStatus(raw)) return raw;
  // Agent drafts land in review so the owner must approve before ship
  return "review";
}

export function resolveIngestChannel(raw?: string | null): ContentChannel | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (isContentChannel(lower)) return lower;
  if (lower === "twitter") return "x";
  return null;
}

/**
 * Create a ContentItem from an automation run (Hermes cron callback or simulate).
 * Emits business log + in-app notification when status is review (needs owner).
 */
export async function ingestContentFromAutomation(
  ctx: ContentIngestContext,
  input: ContentIngestInput,
) {
  const title = normalizeIngestTitle(input.title);
  const bodyMarkdown = (input.bodyMarkdown ?? "").slice(0, 200_000);
  const status = resolveIngestStatus(input.status);
  const channel = resolveIngestChannel(input.channel);
  const source = input.source ?? "hermes";
  const shippedAt = status === "shipped" ? new Date() : null;

  const item = await prisma.contentItem.create({
    data: {
      businessId: ctx.businessId,
      title,
      bodyMarkdown,
      status,
      channel,
      source,
      processId: ctx.processId,
      automationId: ctx.automationId,
      shippedAt,
    },
  });

  await recordBusinessEvent({
    businessId: ctx.businessId,
    userId: ctx.logUserId ?? undefined,
    type: BUSINESS_EVENT_TYPES.CONTENT_CREATED,
    entityType: "content",
    entityId: item.id,
    entityName: item.title,
    summary: `Agent content "${item.title}" (${item.status}) from "${ctx.processName}"`,
    metadata: {
      status: item.status,
      type: item.channel ?? undefined,
      kind: "agent",
      agentId: ctx.automationId,
    },
    ...liveOccurredNow(),
  });

  const needsReview = status === "review" || status === "draft";
  if (needsReview && ctx.ownerUserId) {
    await prisma.notification.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.ownerUserId,
        type: "content_review",
        title: `Review: ${title.slice(0, 120)}`,
        body: `New content from "${ctx.processName}" is ready for review in Content.`,
      },
    });
  }

  return item;
}

export async function findAutomationByIngestToken(token: string) {
  if (!token || token.length < 16) return null;
  return prisma.automation.findFirst({
    where: { ingestToken: token },
    include: {
      process: {
        select: {
          id: true,
          name: true,
          businessId: true,
          business: { select: { userId: true } },
        },
      },
    },
  });
}

export function buildContentIngestUrl(forgeBaseUrl: string): string {
  const base = forgeBaseUrl.replace(/\/$/, "");
  return `${base}/api/content/ingest`;
}

/** Allowed content statuses for ingest API validation. */
export const INGEST_ALLOWED_STATUSES = CONTENT_STATUSES;
export const INGEST_ALLOWED_CHANNELS = CONTENT_CHANNELS;
