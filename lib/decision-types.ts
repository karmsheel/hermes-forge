/**
 * Business decision types — design contract for /decisions and the business log.
 * See docs/references/BUSINESS_LOG_AND_GIT.md § Business decisions.
 *
 * No persistence layer yet; included so log metadata and future APIs share one shape.
 */

export type DecisionStatus = 'active' | 'superseded' | 'revoked';

export type DecisionRelatedEntityType =
  | 'business'
  | 'process'
  | 'automation'
  | 'personnel'
  | 'memory'
  | null;

/** Operational decision record (future BusinessDecision table). */
export interface BusinessDecisionRecord {
  id: string;
  businessId: string;
  /** User who made the decision (typically business owner). */
  decidedByUserId: string | null;
  title: string;
  /** The decision itself — what was chosen or committed to. */
  statement: string;
  /** Why this decision was made. */
  rationale: string | null;
  /** Background, constraints, or meeting notes. */
  context: string | null;
  status: DecisionStatus;
  /** When the owner actually made the decision (may be unknown). */
  decidedAt: string | null;
  /** When this row was first written to Forge. */
  recordedAt: string;
  relatedEntityType: DecisionRelatedEntityType;
  relatedEntityId: string | null;
  /** If superseded, points to the replacing decision. */
  supersededByDecisionId: string | null;
  /** Log sequence of the decision.recorded event that created this row. */
  logSequence: number | null;
}

/** Stored in BusinessEvent.metadata for decision.* log events. */
export interface DecisionEventMetadata {
  decisionId: string;
  title: string;
  statement: string;
  rationale?: string | null;
  context?: string | null;
  status?: DecisionStatus;
  decidedAt?: string | null;
  relatedEntityType?: DecisionRelatedEntityType;
  relatedEntityId?: string | null;
  supersededByDecisionId?: string | null;
  supersededDecisionId?: string;
}