import { prisma } from '@/lib/prisma';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import {
  DecisionExecuteError,
  executeProposedActions,
} from '@/lib/decisions/execute';
import type {
  DecisionKind,
  DecisionOption,
  DecisionRequestRecord,
  ProposedAction,
} from '@/lib/decision-types';

function parseOptions(json: string): DecisionOption[] {
  try {
    const v = JSON.parse(json) as DecisionOption[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseActions(json: string): Record<string, ProposedAction | ProposedAction[]> {
  try {
    const v = JSON.parse(json) as Record<string, ProposedAction | ProposedAction[]>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function serializeDecisionRequest(row: {
  id: string;
  businessId: string;
  title: string;
  summary: string;
  contextMarkdown: string;
  status: string;
  urgency: string;
  proposerKind: string;
  hermesAgentProfileId: string | null;
  conversationId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  relatedEntityName: string | null;
  optionsJson: string;
  proposedActionsJson: string;
  selectedOptionId: string | null;
  redirectMessage: string | null;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  hermesAgentProfile?: {
    id: string;
    displayName: string;
    profileKey: string;
  } | null;
}): DecisionRequestRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    title: row.title,
    summary: row.summary,
    contextMarkdown: row.contextMarkdown,
    status: row.status as DecisionRequestRecord['status'],
    urgency: row.urgency === 'high' ? 'high' : 'normal',
    proposerKind: row.proposerKind as DecisionRequestRecord['proposerKind'],
    hermesAgentProfileId: row.hermesAgentProfileId,
    conversationId: row.conversationId,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    relatedEntityName: row.relatedEntityName,
    options: parseOptions(row.optionsJson),
    proposedActions: parseActions(row.proposedActionsJson),
    selectedOptionId: row.selectedOptionId,
    redirectMessage: row.redirectMessage,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: row.resolvedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    agent: row.hermesAgentProfile
      ? {
          id: row.hermesAgentProfile.id,
          displayName: row.hermesAgentProfile.displayName,
          profileKey: row.hermesAgentProfile.profileKey,
        }
      : null,
  };
}

const requestInclude = {
  hermesAgentProfile: {
    select: { id: true, displayName: true, profileKey: true },
  },
} as const;

export async function createDecisionRequest(input: {
  businessId: string;
  userId: string;
  title: string;
  summary: string;
  contextMarkdown?: string;
  urgency?: 'normal' | 'high';
  proposerKind: 'agent' | 'forge' | 'system';
  hermesAgentProfileId?: string | null;
  conversationId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityName?: string | null;
  options: DecisionOption[];
  proposedActions?: Record<string, ProposedAction | ProposedAction[]>;
}): Promise<DecisionRequestRecord> {
  if (!input.options.length) {
    throw new Error('At least one option is required');
  }

  const row = await prisma.decisionRequest.create({
    data: {
      businessId: input.businessId,
      title: input.title.slice(0, 300),
      summary: input.summary.slice(0, 2000),
      contextMarkdown: input.contextMarkdown ?? '',
      urgency: input.urgency ?? 'normal',
      proposerKind: input.proposerKind,
      hermesAgentProfileId: input.hermesAgentProfileId ?? null,
      conversationId: input.conversationId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityName: input.relatedEntityName ?? null,
      optionsJson: JSON.stringify(input.options),
      proposedActionsJson: JSON.stringify(input.proposedActions ?? {}),
      status: 'pending',
    },
    include: requestInclude,
  });

  await prisma.notification.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      type: 'decision_pending',
      title: input.title.slice(0, 200),
      body: input.summary.slice(0, 500),
      decisionRequestId: row.id,
    },
  });

  await recordBusinessEvent({
    businessId: input.businessId,
    userId: input.userId,
    type: BUSINESS_EVENT_TYPES.DECISION_REQUESTED,
    entityType: 'decision',
    entityId: row.id,
    entityName: row.title,
    summary: `Decision requested: ${row.title}`,
    metadata: {
      requestId: row.id,
      title: row.title,
      decisionKind: 'change',
      status: 'pending',
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
    },
    ...liveOccurredNow(),
  });

  return serializeDecisionRequest(row);
}

async function createDecisionRecord(input: {
  businessId: string;
  userId: string;
  title: string;
  statement: string;
  rationale?: string | null;
  context?: string | null;
  kind: DecisionKind;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  sourceRequestId?: string | null;
  /** Defaults to decision.recorded; redirect uses decision.redirected. */
  logEventType?:
    | typeof BUSINESS_EVENT_TYPES.DECISION_RECORDED
    | typeof BUSINESS_EVENT_TYPES.DECISION_REDIRECTED
    | typeof BUSINESS_EVENT_TYPES.DECISION_SUPERSEDED
    | typeof BUSINESS_EVENT_TYPES.DECISION_REVOKED;
}) {
  const decision = await prisma.businessDecision.create({
    data: {
      businessId: input.businessId,
      decidedByUserId: input.userId,
      title: input.title,
      statement: input.statement,
      rationale: input.rationale ?? null,
      context: input.context ?? null,
      kind: input.kind,
      status: 'active',
      decidedAt: new Date(),
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      sourceRequestId: input.sourceRequestId ?? null,
    },
  });

  const logType = input.logEventType ?? BUSINESS_EVENT_TYPES.DECISION_RECORDED;

  await recordBusinessEvent({
    businessId: input.businessId,
    userId: input.userId,
    type: logType,
    entityType: 'decision',
    entityId: decision.id,
    entityName: decision.title,
    summary: decision.statement,
    metadata: {
      decisionId: decision.id,
      requestId: input.sourceRequestId ?? undefined,
      title: decision.title,
      statement: decision.statement,
      decisionKind: input.kind,
      status: 'active',
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
    occurredAt: decision.decidedAt ?? new Date(),
    occurredAtPrecision: 'exact',
  });

  return decision;
}

export async function resolveDecisionRequest(input: {
  requestId: string;
  businessId: string;
  userId: string;
  optionId: string;
  comment?: string | null;
}): Promise<{
  request: DecisionRequestRecord;
  openChatbar?: {
    conversationId: string | null;
    hermesAgentProfileId: string | null;
    prefill?: string;
  };
}> {
  const row = await prisma.decisionRequest.findFirst({
    where: { id: input.requestId, businessId: input.businessId },
    include: requestInclude,
  });
  if (!row) throw new Error('Decision request not found');
  if (row.status !== 'pending') throw new Error('Decision is no longer pending');

  const options = parseOptions(row.optionsJson);
  const option = options.find((o) => o.id === input.optionId);
  if (!option) throw new Error('Invalid option');

  const actionsMap = parseActions(row.proposedActionsJson);

  if (option.kind === 'redirect') {
    const message =
      input.comment?.trim() ||
      `Redirecting decision "${row.title}": please adjust the approach.`;

    // Ensure studio conversation for agent if possible
    let conversationId = row.conversationId;
    if (row.hermesAgentProfileId && !conversationId) {
      const conv = await prisma.conversation.create({
        data: {
          businessId: input.businessId,
          kind: 'studio',
          title: `Decision: ${row.title}`.slice(0, 120),
          hermesAgentProfileId: row.hermesAgentProfileId,
        },
      });
      conversationId = conv.id;
    }

    if (conversationId) {
      await prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
        },
      });
    }

    const updated = await prisma.decisionRequest.update({
      where: { id: row.id },
      data: {
        status: 'redirected',
        selectedOptionId: option.id,
        redirectMessage: message,
        resolvedAt: new Date(),
        resolvedByUserId: input.userId,
        conversationId,
      },
      include: requestInclude,
    });

    await createDecisionRecord({
      businessId: input.businessId,
      userId: input.userId,
      title: row.title,
      statement: `Redirected: ${message}`,
      kind: 'redirect',
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      sourceRequestId: row.id,
      context: row.contextMarkdown,
      logEventType: BUSINESS_EVENT_TYPES.DECISION_REDIRECTED,
    });

    await prisma.notification.create({
      data: {
        businessId: input.businessId,
        userId: input.userId,
        type: 'decision_resolved',
        title: `Redirected: ${row.title}`,
        body: message.slice(0, 500),
        decisionRequestId: row.id,
      },
    });

    return {
      request: serializeDecisionRequest(updated),
      openChatbar: {
        conversationId,
        hermesAgentProfileId: row.hermesAgentProfileId,
        prefill: message,
      },
    };
  }

  if (option.kind === 'reject') {
    const updated = await prisma.decisionRequest.update({
      where: { id: row.id },
      data: {
        status: 'resolved',
        selectedOptionId: option.id,
        resolvedAt: new Date(),
        resolvedByUserId: input.userId,
      },
      include: requestInclude,
    });

    await createDecisionRecord({
      businessId: input.businessId,
      userId: input.userId,
      title: row.title,
      statement: `Rejected option: ${option.label}`,
      kind: 'reject',
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      sourceRequestId: row.id,
      rationale: input.comment ?? null,
    });

    await prisma.notification.create({
      data: {
        businessId: input.businessId,
        userId: input.userId,
        type: 'decision_resolved',
        title: `Rejected: ${row.title}`,
        body: option.label,
        decisionRequestId: row.id,
      },
    });

    return { request: serializeDecisionRequest(updated) };
  }

  // approve | custom → execute actions
  const actionKey = option.actionKey ?? option.id;
  const actions = actionsMap[actionKey] ?? actionsMap[option.id] ?? { type: 'noop' as const };

  try {
    await executeProposedActions(actions, {
      businessId: input.businessId,
      userId: input.userId,
    });
  } catch (e) {
    if (e instanceof DecisionExecuteError) throw e;
    throw e;
  }

  const kind: DecisionKind =
    Array.isArray(actions)
      ? actions.some((a) => a.type.startsWith('forge'))
        ? 'forge'
        : 'change'
      : actions.type.startsWith('forge')
        ? 'forge'
        : 'change';

  const updated = await prisma.decisionRequest.update({
    where: { id: row.id },
    data: {
      status: 'resolved',
      selectedOptionId: option.id,
      resolvedAt: new Date(),
      resolvedByUserId: input.userId,
    },
    include: requestInclude,
  });

  await createDecisionRecord({
    businessId: input.businessId,
    userId: input.userId,
    title: row.title,
    statement: `Approved: ${option.label}`,
    kind,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    sourceRequestId: row.id,
    rationale: input.comment ?? null,
    context: row.summary,
  });

  // Special-case process forge log
  if (
    (!Array.isArray(actions) && actions.type === 'forge_process') ||
    (Array.isArray(actions) && actions.some((a) => a.type === 'forge_process'))
  ) {
    const processId = Array.isArray(actions)
      ? (actions.find((a) => a.type === 'forge_process') as { processId: string }).processId
      : (actions as { processId: string }).processId;
    const process = await prisma.process.findUnique({ where: { id: processId } });
    if (process) {
      await recordBusinessEvent({
        businessId: input.businessId,
        userId: input.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_APPROVED,
        entityType: 'process',
        entityId: process.id,
        entityName: process.name,
        summary: `Forged process "${process.name}"`,
        ...liveOccurredNow(),
      });
    }
  }

  await prisma.notification.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      type: 'decision_resolved',
      title: `Approved: ${row.title}`,
      body: option.label,
      decisionRequestId: row.id,
    },
  });

  return { request: serializeDecisionRequest(updated) };
}

/** Human forges a process directly (with decision record). */
export async function forgeProcessDirect(input: {
  businessId: string;
  userId: string;
  processId: string;
}): Promise<void> {
  const process = await prisma.process.findFirst({
    where: { id: input.processId, businessId: input.businessId },
  });
  if (!process) throw new Error('Process not found');
  if (!process.diagramMermaid?.trim()) {
    throw new Error('Process needs a diagram before it can be forged');
  }

  await prisma.process.update({
    where: { id: process.id },
    data: { status: 'forged', approvedAt: new Date() },
  });

  await createDecisionRecord({
    businessId: input.businessId,
    userId: input.userId,
    title: `Forge process: ${process.name}`,
    statement: `Owner forged process "${process.name}" as live business documentation`,
    kind: 'forge',
    relatedEntityType: 'process',
    relatedEntityId: process.id,
  });

  await recordBusinessEvent({
    businessId: input.businessId,
    userId: input.userId,
    type: BUSINESS_EVENT_TYPES.PROCESS_APPROVED,
    entityType: 'process',
    entityId: process.id,
    entityName: process.name,
    summary: `Forged process "${process.name}"`,
    ...liveOccurredNow(),
  });
}

export async function forgeDocumentDirect(input: {
  businessId: string;
  userId: string;
  documentId: string;
}): Promise<void> {
  const doc = await prisma.businessDocument.findFirst({
    where: { id: input.documentId, businessId: input.businessId },
  });
  if (!doc) throw new Error('Document not found');

  await prisma.businessDocument.update({
    where: { id: doc.id },
    data: { lifecycleStatus: 'forged', forgedAt: new Date() },
  });

  await createDecisionRecord({
    businessId: input.businessId,
    userId: input.userId,
    title: `Forge document: ${doc.title}`,
    statement: `Owner forged document "${doc.title}" as live business knowledge`,
    kind: 'forge',
    relatedEntityType: 'document',
    relatedEntityId: doc.id,
  });
}

/** Record owner live edit on a forged asset. */
export async function recordLiveOwnerEdit(input: {
  businessId: string;
  userId: string;
  entityType: 'process' | 'document';
  entityId: string;
  entityName: string;
  summary: string;
}): Promise<void> {
  await createDecisionRecord({
    businessId: input.businessId,
    userId: input.userId,
    title: `Live edit: ${input.entityName}`,
    statement: input.summary,
    kind: 'change',
    relatedEntityType: input.entityType,
    relatedEntityId: input.entityId,
    rationale: 'Owner confirmed live documentation change',
  });
}
