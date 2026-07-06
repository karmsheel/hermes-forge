import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { parseEventMetadata } from '@/lib/business-log';

export interface BusinessLogBundleEventV1 {
  sequence: number;
  type: string;
  recordedAt: string;
  occurredAt: string | null;
  occurredAtPrecision: string;
  ingestion: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  userId: string | null;
}

export interface BusinessLogBundleV1 {
  version: 1;
  exportedAt: string;
  business: { id: string; name: string };
  log: {
    headSequence: number;
    events: BusinessLogBundleEventV1[];
  };
  checksum: string;
}

export function canonicalizeBundleEvents(
  events: BusinessLogBundleEventV1[]
): string {
  return JSON.stringify(events);
}

export function computeBundleChecksum(events: BusinessLogBundleEventV1[]): string {
  return createHash('sha256').update(canonicalizeBundleEvents(events)).digest('hex');
}

export function businessEventRowToBundleEvent(event: {
  sequence: number;
  type: string;
  recordedAt: Date;
  occurredAt: Date | null;
  occurredAtPrecision: string;
  ingestion: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  summary: string;
  metadata: string | null;
  userId: string | null;
}): BusinessLogBundleEventV1 {
  return {
    sequence: event.sequence,
    type: event.type,
    recordedAt: event.recordedAt.toISOString(),
    occurredAt: event.occurredAt?.toISOString() ?? null,
    occurredAtPrecision: event.occurredAtPrecision,
    ingestion: event.ingestion,
    entityType: event.entityType,
    entityId: event.entityId,
    entityName: event.entityName,
    summary: event.summary,
    metadata: parseEventMetadata(event.metadata) as Record<string, unknown> | null,
    userId: event.userId,
  };
}

export function serializeLogEventLine(event: BusinessLogBundleEventV1): string {
  return JSON.stringify(event);
}

export async function buildBusinessLogBundle(
  businessId: string
): Promise<BusinessLogBundleV1> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, logHeadSequence: true },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const rows = await prisma.businessEvent.findMany({
    where: { businessId },
    orderBy: { sequence: 'asc' },
  });

  const events: BusinessLogBundleEventV1[] = rows.map(businessEventRowToBundleEvent);

  const checksum = computeBundleChecksum(events);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    business: { id: business.id, name: business.name },
    log: {
      headSequence: business.logHeadSequence,
      events,
    },
    checksum,
  };
}