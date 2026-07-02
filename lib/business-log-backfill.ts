import { prisma } from '@/lib/prisma';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { recordBusinessEvent, truncatePreview } from '@/lib/business-log';

export async function backfillBusinessLog(businessId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { backfillCompletedAt: true },
  });

  if (!business || business.backfillCompletedAt) return;

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
    source: 'backfill',
    createdAt: full.createdAt,
  });

  for (const process of full.processes) {
    await recordBusinessEvent({
      businessId,
      type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
      entityType: 'process',
      entityId: process.id,
      entityName: process.name,
      summary: `Created process "${process.name}"`,
      source: 'backfill',
      createdAt: process.createdAt,
    });

    if (process.diagramUpdatedAt && process.diagramMermaid) {
      await recordBusinessEvent({
        businessId,
        type: BUSINESS_EVENT_TYPES.PROCESS_DIAGRAM_UPDATED,
        entityType: 'process',
        entityId: process.id,
        entityName: process.name,
        summary: `Updated diagram for "${process.name}"`,
        source: 'backfill',
        createdAt: process.diagramUpdatedAt,
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
        source: 'backfill',
        createdAt: process.approvedAt,
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
        source: 'backfill',
        createdAt: process.updatedAt,
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
        source: 'backfill',
        createdAt: message.createdAt,
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
        source: 'backfill',
        createdAt: automation.createdAt,
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
          source: 'backfill',
          createdAt: automation.deployedAt,
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
        source: 'backfill',
        createdAt: first.lastUpdated,
      });
    }
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { backfillCompletedAt: new Date() },
  });
}