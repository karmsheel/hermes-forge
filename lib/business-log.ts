import { prisma } from '@/lib/prisma';
import type {
  BusinessEventMetadata,
  BusinessEventRecord,
  BusinessLogFilter,
  RecordBusinessEventInput,
} from '@/lib/business-log-types';

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
): Promise<void> {
  try {
    await prisma.businessEvent.create({
      data: {
        businessId: input.businessId,
        userId: input.userId ?? null,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        entityName: input.entityName ?? null,
        summary: input.summary,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        source: input.source ?? 'live',
        createdAt: input.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to record business event', error);
  }
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
  const cursorDate = options.cursor ? new Date(options.cursor) : null;

  const typePrefix =
    options.filter && options.filter !== 'all' ? options.filter : null;

  const events = await prisma.businessEvent.findMany({
    where: {
      businessId,
      ...(typePrefix ? { type: { startsWith: `${typePrefix}.` } } : {}),
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  return {
    events: page.map((event) => ({
      id: event.id,
      businessId: event.businessId,
      userId: event.userId,
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      entityName: event.entityName,
      summary: event.summary,
      metadata: event.metadata,
      source: event.source,
      createdAt: event.createdAt.toISOString(),
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