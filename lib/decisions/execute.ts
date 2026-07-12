import { prisma } from '@/lib/prisma';
import type { ProposedAction } from '@/lib/decision-types';
import { isProcessForged } from '@/lib/process-status';

export class DecisionExecuteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionExecuteError';
  }
}

/**
 * Apply one or more proposed actions after the human approved a decision option.
 */
export async function executeProposedActions(
  actions: ProposedAction | ProposedAction[],
  ctx: { businessId: string; userId: string }
): Promise<{ applied: string[] }> {
  const list = Array.isArray(actions) ? actions : [actions];
  const applied: string[] = [];

  for (const action of list) {
    switch (action.type) {
      case 'noop':
        applied.push('noop');
        break;

      case 'forge_process':
      case 'set_process_lifecycle': {
        const processId =
          action.type === 'forge_process' ? action.processId : action.processId;
        const to =
          action.type === 'forge_process'
            ? 'forged'
            : action.to;
        const process = await prisma.process.findFirst({
          where: { id: processId, businessId: ctx.businessId },
        });
        if (!process) throw new DecisionExecuteError('Process not found');
        if (to === 'forged' && !process.diagramMermaid?.trim()) {
          throw new DecisionExecuteError('Process needs a diagram before it can be forged');
        }
        await prisma.process.update({
          where: { id: processId },
          data: {
            status: to,
            approvedAt: to === 'forged' ? new Date() : null,
          },
        });
        applied.push(`${action.type}:${processId}`);
        break;
      }

      case 'forge_document':
      case 'set_document_lifecycle': {
        const documentId = action.documentId;
        const to =
          action.type === 'forge_document' ? 'forged' : action.to;
        const doc = await prisma.businessDocument.findFirst({
          where: { id: documentId, businessId: ctx.businessId },
        });
        if (!doc) throw new DecisionExecuteError('Document not found');
        await prisma.businessDocument.update({
          where: { id: documentId },
          data: {
            lifecycleStatus: to,
            forgedAt: to === 'forged' ? new Date() : null,
          },
        });
        applied.push(`${action.type}:${documentId}`);
        break;
      }

      case 'patch_process': {
        const process = await prisma.process.findFirst({
          where: { id: action.processId, businessId: ctx.businessId },
        });
        if (!process) throw new DecisionExecuteError('Process not found');
        // Execution is authorized by the decision — allow even if forged
        await prisma.process.update({
          where: { id: action.processId },
          data: {
            ...(action.patch.name !== undefined ? { name: action.patch.name } : {}),
            ...(action.patch.description !== undefined
              ? { description: action.patch.description }
              : {}),
            ...(action.patch.department !== undefined
              ? { department: action.patch.department }
              : {}),
            ...(action.patch.trigger !== undefined ? { trigger: action.patch.trigger } : {}),
            ...(action.patch.inputs !== undefined ? { inputs: action.patch.inputs } : {}),
            ...(action.patch.outputs !== undefined ? { outputs: action.patch.outputs } : {}),
            ...(action.patch.manualSteps !== undefined
              ? { manualSteps: action.patch.manualSteps }
              : {}),
            ...(action.patch.diagramMermaid !== undefined
              ? {
                  diagramMermaid: action.patch.diagramMermaid,
                  diagramUpdatedAt: new Date(),
                }
              : {}),
          },
        });
        applied.push(`patch_process:${action.processId}`);
        break;
      }

      case 'patch_document': {
        const doc = await prisma.businessDocument.findFirst({
          where: { id: action.documentId, businessId: ctx.businessId },
        });
        if (!doc) throw new DecisionExecuteError('Document not found');
        await prisma.businessDocument.update({
          where: { id: action.documentId },
          data: {
            ...(action.patch.title !== undefined ? { title: action.patch.title } : {}),
            ...(action.patch.bodyMarkdown !== undefined
              ? { bodyMarkdown: action.patch.bodyMarkdown }
              : {}),
            ...(action.patch.kind !== undefined ? { kind: action.patch.kind } : {}),
            ...(action.patch.pinnedForContext !== undefined
              ? { pinnedForContext: action.patch.pinnedForContext }
              : {}),
            source: doc.source === 'seed' ? 'manual' : doc.source,
          },
        });
        applied.push(`patch_document:${action.documentId}`);
        break;
      }

      default:
        throw new DecisionExecuteError(`Unknown action type`);
    }
  }

  return { applied };
}

export function assertAgentMayMutateProcess(status: string): void {
  if (isProcessForged(status)) {
    throw new DecisionExecuteError(
      'This process is forged. Propose a decision for the owner to approve changes.'
    );
  }
}

export function assertAgentMayMutateDocument(lifecycleStatus: string): void {
  if (lifecycleStatus === 'forged') {
    throw new DecisionExecuteError(
      'This document is forged. Propose a decision for the owner to approve changes.'
    );
  }
}
