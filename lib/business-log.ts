import { prisma } from '@/lib/prisma';
import { backfillBusinessLog } from '@/lib/business-log-backfill';
import type {
  BusinessEventMetadata,
  BusinessEventRecord,
  BusinessLogFilter,
  RecordBusinessEventInput,
} from '@/lib/business-log-types';
import { resolveOccurredAtPrecision } from '@/lib/business-log-types';

const TRACKED_PROCESS_FIELDS = [
  'name',
  'description',
  'department',
  'status',
  'trigger',
  'inputs',
  'outputs',
  'manualSteps',
] as const;

/** Live event that happened at request time. */
export function liveOccurredNow() {
  return {
    occurredAt: new Date(),
    occurredAtPrecision: 'exact' as const,
  };
}

export function truncatePreview(text: string, max = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function diffProcessFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const changes = [];
  for (const field of TRACKED_PROCESS_FIELDS) {
    const prev = before[field];
    const next = after[field];
    if (next === undefined) continue;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push({ field, before: prev ?? null, after: next ?? null });
    }
  }
  return changes;
}

export function diffBusinessFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const fields = ['name', 'description', 'industry', 'teamSize', 'goals'] as const;
  const changes = [];
  for (const field of fields) {
    const prev = before[field];
    const next = after[field];
    if (next === undefined) continue;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push({ field, before: prev ?? null, after: next ?? null });
    }
  }
  return changes;
}

export async function recordBusinessEvent(
  input: RecordBusinessEventInput
): Promise<{ sequence: number } | null> {
  const recordedAt = new Date();
  const occurredAt = input.occurredAt ?? null;
  const occurredAtPrecision = resolveOccurredAtPrecision(input, occurredAt);
  const ingestion = input.ingestion ?? 'live';

  try {
    return await prisma.$transaction(async (tx) => {
      const head = await tx.business.update({
        where: { id: input.businessId },
        data: {
          logHeadSequence: { increment: 1 },
          gitDirty: true,
        },
        select: { logHeadSequence: true },
      });

      await tx.businessEvent.create({
        data: {
          businessId: input.businessId,
          userId: input.userId ?? null,
          sequence: head.logHeadSequence,
          type: input.type,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          entityName: input.entityName ?? null,
          summary: input.summary,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          recordedAt,
          occurredAt,
          occurredAtPrecision,
          ingestion,
        },
      });

      return { sequence: head.logHeadSequence };
    });
  } catch (error) {
    console.error('Failed to record business event', error);
    return null;
  }
}

export async function ensureBusinessLogInitialized(businessId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { logInitializedAt: true, _count: { select: { events: true } } },
  });

  if (!business || business.logInitializedAt) return;

  if (business._count.events === 0) {
    await backfillBusinessLog(businessId);
    return;
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { logInitializedAt: new Date() },
  });
}

export async function markBusinessLogInitialized(businessId: string): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { logInitializedAt: new Date() },
  });
}

export async function getBusinessEvents(
  businessId: string,
  options: {
    cursor?: string | null;
    limit?: number;
    filter?: BusinessLogFilter;
  } = {}
): Promise<{ events: BusinessEventRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const cursorSequence = options.cursor ? Number.parseInt(options.cursor, 10) : null;

  const typePrefix =
    options.filter && options.filter !== 'all' ? options.filter : null;

  const events = await prisma.businessEvent.findMany({
    where: {
      businessId,
      ...(typePrefix ? { type: { startsWith: `${typePrefix}.` } } : {}),
      ...(cursorSequence != null && Number.isFinite(cursorSequence)
        ? { sequence: { lt: cursorSequence } }
        : {}),
    },
    orderBy: [{ recordedAt: 'desc' }, { sequence: 'desc' }],
    take: limit + 1,
  });

  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore
    ? String(page[page.length - 1].sequence)
    : null;

  return {
    events: page.map((event) => ({
      id: event.id,
      businessId: event.businessId,
      userId: event.userId,
      sequence: event.sequence,
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      entityName: event.entityName,
      summary: event.summary,
      metadata: event.metadata,
      recordedAt: event.recordedAt.toISOString(),
      occurredAt: event.occurredAt?.toISOString() ?? null,
      occurredAtPrecision: event.occurredAtPrecision,
      ingestion: event.ingestion,
    })),
    nextCursor,
  };
}

export function parseEventMetadata(
  metadata: string | null
): BusinessEventMetadata | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as BusinessEventMetadata;
  } catch {
    return null;
  }
}