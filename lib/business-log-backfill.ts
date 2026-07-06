import { prisma } from '@/lib/prisma';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { recordBusinessEvent, truncatePreview } from '@/lib/business-log';

export async function backfillBusinessLog(businessId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      logInitializedAt: true,
      _count: { select: { events: true } },
    },
  });

  if (!business || business.logInitializedAt || business._count.events > 0) return;

  const full = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      processes: {
        include: {
          messages: { where: { role: 'user' }, orderBy: { createdAt: 'asc' } },
          automation: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      memories: { orderBy: { lastUpdated: 'asc' } },
    },
  });

  if (!full) return;

  await recordBusinessEvent({
    businessId,
    type: BUSINESS_EVENT_TYPES.BUSINESS_CREATED,
    entityType: 'business',
    entityId: full.id,
    entityName: full.name,
    summary: `Created business "${full.name}"`,
    ingestion: 'backfill',
    occurredAt: full.createdAt,
    occurredAtPrecision: 'approximate',
  });

  for (const process of full.processes) {
    await recordBusinessEvent({
      businessId,
      type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
      entityType: 'process',
      entityId: process.id,
      entityName: process.name,
      summary: `Created process "${process.name}"`,
      ingestion: 'backfill',
      occurredAt: process.createdAt,
      occurredAtPrecision: 'approximate',
    });

    if (process.diagramUpdatedAt && process.diagramMermaid) {
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.PROCESS_DIAGRAM_UPDATED,
        entityType: 'process',
        entityId: process.id,
        entityName: process.name,
        summary: `Updated diagram for "${process.name}"`,
        ingestion: 'backfill',
        occurredAt: process.diagramUpdatedAt,
        occurredAtPrecision: 'approximate',
      });
    }

    if (process.approvedAt && process.status === 'approved') {
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.PROCESS_APPROVED,
        entityType: 'process',
        entityId: process.id,
        entityName: process.name,
        summary: `Approved process "${process.name}"`,
        ingestion: 'backfill',
        occurredAt: process.approvedAt,
        occurredAtPrecision: 'approximate',
      });
    }

    if (process.nameStatus === 'confirmed') {
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.PROCESS_NAME_CONFIRMED,
        entityType: 'process',
        entityId: process.id,
        entityName: process.name,
        summary: `Confirmed name "${process.name}"`,
        ingestion: 'backfill',
        occurredAt: null,
        occurredAtPrecision: 'unknown',
      });
    }

    for (const message of process.messages) {
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE,
        entityType: 'chat',
        entityId: process.id,
        entityName: process.name,
        summary: `Message in "${process.name}"`,
        metadata: { preview: truncatePreview(message.content), role: 'user' },
        ingestion: 'backfill',
        occurredAt: message.createdAt,
        occurredAtPrecision: 'approximate',
      });
    }

    if (process.automation) {
      const automation = process.automation;
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.AUTOMATION_STUDIO_OPENED,
        entityType: 'automation',
        entityId: process.id,
        entityName: process.name,
        summary: `Opened automation studio for "${process.name}"`,
        ingestion: 'backfill',
        occurredAt: automation.createdAt,
        occurredAtPrecision: 'approximate',
      });

      if (automation.deployedAt) {
        await recordBusinessEvent({
          businessId,
          type: BUSINESS_EVENT_TYPES.AUTOMATION_DEPLOYED,
          entityType: 'automation',
          entityId: process.id,
          entityName: process.name,
          summary: `Deployed automation for "${process.name}"`,
          metadata: { type: automation.type ?? undefined, status: automation.status },
          ingestion: 'backfill',
          occurredAt: automation.deployedAt,
          occurredAtPrecision: 'approximate',
        });
      }
    }
  }

  if (full.memories.length > 0) {
    const grouped = new Map<string, typeof full.memories>();
    for (const memory of full.memories) {
      const key = memory.source ?? 'unknown';
      const list = grouped.get(key) ?? [];
      list.push(memory);
      grouped.set(key, list);
    }

    for (const [, memories] of grouped) {
      const first = memories[0];
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.MEMORY_FACT_ADDED,
        entityType: 'memory',
        entityId: first.id,
        entityName: full.name,
        summary: `Added ${memories.length} business fact${memories.length === 1 ? '' : 's'}`,
        metadata: {
          count: memories.length,
          preview: truncatePreview(memories[0].fact),
        },
        ingestion: 'backfill',
        occurredAt: first.lastUpdated,
        occurredAtPrecision: 'approximate',
      });
    }
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { logInitializedAt: new Date() },
  });
}