/**
 * HITL decisions (4.12) — pending requests + durable records.
 */

export type DecisionRecordStatus = 'active' | 'superseded' | 'revoked';
export type DecisionKind = 'forge' | 'change' | 'policy' | 'redirect' | 'reject';

export type DecisionRelatedEntityType =
  | 'business'
  | 'process'
  | 'document'
  | 'automation'
  | 'personnel'
  | 'memory'
  | null;

export type DecisionRequestStatus =
  | 'pending'
  | 'resolved'
  | 'redirected'
  | 'cancelled';

export type DecisionProposerKind = 'agent' | 'forge' | 'system';

export type DecisionOptionKind = 'approve' | 'reject' | 'redirect' | 'custom';

export interface DecisionOption {
  id: string;
  label: string;
  kind: DecisionOptionKind;
  /** When kind is approve/custom, executes this action key in proposedActions. */
  actionKey?: string;
  primary?: boolean;
}

export type ProposedAction =
  | { type: 'forge_process'; processId: string }
  | { type: 'forge_document'; documentId: string }
  | {
      type: 'set_process_lifecycle';
      processId: string;
      to: 'draft' | 'refined' | 'forged';
    }
  | {
      type: 'set_document_lifecycle';
      documentId: string;
      to: 'draft' | 'refined' | 'forged';
    }
  | {
      type: 'patch_process';
      processId: string;
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
    }
  | {
      type: 'patch_document';
      documentId: string;
      patch: {
        title?: string;
        bodyMarkdown?: string;
        kind?: string;
        pinnedForContext?: boolean;
      };
    }
  | { type: 'noop' };

export interface BusinessDecisionRecord {
  id: string;
  businessId: string;
  decidedByUserId: string | null;
  title: string;
  statement: string;
  rationale: string | null;
  context: string | null;
  kind: DecisionKind;
  status: DecisionRecordStatus;
  decidedAt: string | null;
  recordedAt: string;
  relatedEntityType: DecisionRelatedEntityType;
  relatedEntityId: string | null;
  supersededByDecisionId: string | null;
  sourceRequestId: string | null;
  logSequence: number | null;
}

export interface DecisionRequestRecord {
  id: string;
  businessId: string;
  title: string;
  summary: string;
  contextMarkdown: string;
  status: DecisionRequestStatus;
  urgency: 'normal' | 'high';
  proposerKind: DecisionProposerKind;
  hermesAgentProfileId: string | null;
  conversationId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  relatedEntityName: string | null;
  options: DecisionOption[];
  proposedActions: Record<string, ProposedAction | ProposedAction[]>;
  selectedOptionId: string | null;
  redirectMessage: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  agent?: {
    id: string;
    displayName: string;
    profileKey: string;
  } | null;
}

export interface DecisionEventMetadata {
  decisionId?: string;
  requestId?: string;
  title: string;
  statement?: string;
  rationale?: string | null;
  context?: string | null;
  status?: string;
  kind?: string;
  decidedAt?: string | null;
  relatedEntityType?: DecisionRelatedEntityType | string | null;
  relatedEntityId?: string | null;
  supersededByDecisionId?: string | null;
  supersededDecisionId?: string;
  optionId?: string;
  optionLabel?: string;
}

export type NotificationType =
  | 'info'
  | 'decision_pending'
  | 'decision_resolved'
  | 'system';

export interface NotificationRecord {
  id: string;
  businessId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  decisionRequestId: string | null;
  readAt: string | null;
  createdAt: string;
}
