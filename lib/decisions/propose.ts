/**
 * Auto-propose HITL decisions when agents try to change forged assets (4.12 loop).
 */

import { prisma } from '@/lib/prisma';
import { createDecisionRequest } from '@/lib/decisions/service';
import type {
  DecisionOption,
  DecisionRequestRecord,
  ProposedAction,
} from '@/lib/decision-types';
import { isProcessForged } from '@/lib/process-status';

export function defaultChangeOptions(): DecisionOption[] {
  return [
    {
      id: 'approve',
      label: 'Approve change',
      kind: 'approve',
      actionKey: 'apply',
      primary: true,
    },
    {
      id: 'reject',
      label: 'Reject',
      kind: 'reject',
    },
    {
      id: 'redirect',
      label: 'Redirect / comment',
      kind: 'redirect',
    },
  ];
}

/**
 * If process is forged, create a decision request instead of applying the diagram.
 * Returns null when process is not forged (caller should apply change normally).
 */
export async function proposeForgedDiagramChange(input: {
  businessId: string;
  userId: string;
  processId: string;
  processName: string;
  processStatus: string;
  proposedDiagram: string;
  conversationId?: string | null;
  hermesAgentProfileId?: string | null;
}): Promise<DecisionRequestRecord | null> {
  if (!isProcessForged(input.processStatus)) return null;
  if (!input.proposedDiagram.trim()) return null;

  // Avoid spam: if an identical pending diagram decision exists, return it
  const pending = await prisma.decisionRequest.findMany({
    where: {
      businessId: input.businessId,
      status: 'pending',
      relatedEntityType: 'process',
      relatedEntityId: input.processId,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const row of pending) {
    try {
      const actions = JSON.parse(row.proposedActionsJson) as Record<
        string,
        ProposedAction | ProposedAction[]
      >;
      const apply = actions.apply;
      const action = Array.isArray(apply) ? apply[0] : apply;
      if (
        action &&
        action.type === 'patch_process' &&
        action.patch.diagramMermaid === input.proposedDiagram
      ) {
        const { serializeDecisionRequest } = await import('@/lib/decisions/service');
        const full = await prisma.decisionRequest.findUniqueOrThrow({
          where: { id: row.id },
          include: {
            hermesAgentProfile: {
              select: { id: true, displayName: true, profileKey: true },
            },
          },
        });
        return serializeDecisionRequest(full);
      }
    } catch {
      // ignore parse errors
    }
  }

  return createDecisionRequest({
    businessId: input.businessId,
    userId: input.userId,
    title: `Update diagram: ${input.processName}`,
    summary: `An agent proposes a new process diagram for forged process "${input.processName}". Approve to apply, reject to keep the current diagram, or redirect with instructions.`,
    contextMarkdown: [
      `**Process:** ${input.processName}`,
      '',
      '**Proposed Mermaid (preview):**',
      '```mermaid',
      input.proposedDiagram.slice(0, 8000),
      '```',
    ].join('\n'),
    urgency: 'normal',
    proposerKind: input.hermesAgentProfileId ? 'agent' : 'forge',
    hermesAgentProfileId: input.hermesAgentProfileId ?? null,
    conversationId: input.conversationId ?? null,
    relatedEntityType: 'process',
    relatedEntityId: input.processId,
    relatedEntityName: input.processName,
    options: defaultChangeOptions(),
    proposedActions: {
      apply: {
        type: 'patch_process',
        processId: input.processId,
        patch: { diagramMermaid: input.proposedDiagram },
      },
    },
  });
}

/**
 * Propose a general process field patch for a forged process.
 */
export async function proposeForgedProcessPatch(input: {
  businessId: string;
  userId: string;
  processId: string;
  processName: string;
  processStatus: string;
  patch: {
    name?: string;
    description?: string;
    department?: string;
    trigger?: string | null;
    inputs?: string | null;
    outputs?: string | null;
    manualSteps?: string | null;
    diagramMermaid?: string | null;
  };
  conversationId?: string | null;
  hermesAgentProfileId?: string | null;
  title?: string;
  summary?: string;
}): Promise<DecisionRequestRecord | null> {
  if (!isProcessForged(input.processStatus)) return null;

  const fields = Object.keys(input.patch).filter(
    (k) => input.patch[k as keyof typeof input.patch] !== undefined
  );
  if (fields.length === 0) return null;

  return createDecisionRequest({
    businessId: input.businessId,
    userId: input.userId,
    title: input.title ?? `Change forged process: ${input.processName}`,
    summary:
      input.summary ??
      `Agent proposes updates to fields: ${fields.join(', ')} on forged process "${input.processName}".`,
    contextMarkdown: [
      `**Process:** ${input.processName}`,
      `**Fields:** ${fields.join(', ')}`,
      '',
      '```json',
      JSON.stringify(input.patch, null, 2).slice(0, 6000),
      '```',
    ].join('\n'),
    urgency: 'normal',
    proposerKind: input.hermesAgentProfileId ? 'agent' : 'forge',
    hermesAgentProfileId: input.hermesAgentProfileId ?? null,
    conversationId: input.conversationId ?? null,
    relatedEntityType: 'process',
    relatedEntityId: input.processId,
    relatedEntityName: input.processName,
    options: defaultChangeOptions(),
    proposedActions: {
      apply: {
        type: 'patch_process',
        processId: input.processId,
        patch: input.patch,
      },
    },
  });
}

export async function proposeForgedDocumentPatch(input: {
  businessId: string;
  userId: string;
  documentId: string;
  documentTitle: string;
  lifecycleStatus: string;
  patch: {
    title?: string;
    bodyMarkdown?: string;
    kind?: string;
    pinnedForContext?: boolean;
  };
  conversationId?: string | null;
  hermesAgentProfileId?: string | null;
}): Promise<DecisionRequestRecord | null> {
  if (input.lifecycleStatus !== 'forged') return null;

  const fields = Object.keys(input.patch).filter(
    (k) => input.patch[k as keyof typeof input.patch] !== undefined
  );
  if (fields.length === 0) return null;

  return createDecisionRequest({
    businessId: input.businessId,
    userId: input.userId,
    title: `Change forged document: ${input.documentTitle}`,
    summary: `Agent proposes updates to forged document "${input.documentTitle}" (${fields.join(', ')}).`,
    contextMarkdown: [
      `**Document:** ${input.documentTitle}`,
      `**Fields:** ${fields.join(', ')}`,
      '',
      input.patch.bodyMarkdown
        ? `**Body preview:**\n\n${input.patch.bodyMarkdown.slice(0, 4000)}`
        : JSON.stringify(input.patch, null, 2).slice(0, 4000),
    ].join('\n'),
    urgency: 'normal',
    proposerKind: input.hermesAgentProfileId ? 'agent' : 'forge',
    hermesAgentProfileId: input.hermesAgentProfileId ?? null,
    conversationId: input.conversationId ?? null,
    relatedEntityType: 'document',
    relatedEntityId: input.documentId,
    relatedEntityName: input.documentTitle,
    options: defaultChangeOptions(),
    proposedActions: {
      apply: {
        type: 'patch_document',
        documentId: input.documentId,
        patch: input.patch,
      },
    },
  });
}
