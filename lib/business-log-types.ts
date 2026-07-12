export const BUSINESS_EVENT_TYPES = {
  BUSINESS_CREATED: 'business.created',
  BUSINESS_UPDATED: 'business.updated',
  BUSINESS_IMPORTED: 'business.imported',
  BUSINESS_DELETED: 'business.deleted',

  PROCESS_CREATED: 'process.created',
  PROCESS_UPDATED: 'process.updated',
  PROCESS_DELETED: 'process.deleted',
  PROCESS_SPLIT: 'process.split',
  PROCESS_APPROVED: 'process.approved',
  PROCESS_DIAGRAM_UPDATED: 'process.diagram_updated',
  PROCESS_NAME_CONFIRMED: 'process.name_confirmed',

  CHAT_USER_MESSAGE: 'chat.user_message',
  CHAT_ASSISTANT_ACTION: 'chat.assistant_action',

  AUTOMATION_STUDIO_OPENED: 'automation.studio_opened',
  AUTOMATION_PLAN_EXTRACTED: 'automation.plan_extracted',
  AUTOMATION_DEPLOYED: 'automation.deployed',
  AUTOMATION_SYNCED: 'automation.synced',
  AUTOMATION_CREDENTIALS_MAPPED: 'automation.credentials_mapped',
  AUTOMATION_STATUS_CHANGED: 'automation.status_changed',
  /** Hired Hermes agent assigned (or cleared) as owner of an automation. */
  AUTOMATION_AGENT_ASSIGNED: 'automation.agent_assigned',

  MEMORY_FACT_ADDED: 'memory.fact_added',

  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_DELETED: 'document.deleted',

  CONTENT_CREATED: 'content.created',
  CONTENT_UPDATED: 'content.updated',
  CONTENT_DELETED: 'content.deleted',
  CONTENT_STATUS_CHANGED: 'content.status_changed',

  METRIC_CREATED: 'metric.created',
  METRIC_SAMPLE_RECORDED: 'metric.sample_recorded',
  METRIC_DELETED: 'metric.deleted',

  PERSONNEL_ADDED: 'personnel.added',
  PERSONNEL_HIRED: 'personnel.hired',
  /** Name / role / roleDescription changes on a human roster member. */
  PERSONNEL_UPDATED: 'personnel.updated',
  /** Human delete + agent fire both emit this (no separate personnel.removed). */
  PERSONNEL_FIRED: 'personnel.fired',

  DECISION_RECORDED: 'decision.recorded',
  DECISION_SUPERSEDED: 'decision.superseded',
  DECISION_REVOKED: 'decision.revoked',
  DECISION_REDIRECTED: 'decision.redirected',
} as const;

export type BusinessEventType =
  (typeof BUSINESS_EVENT_TYPES)[keyof typeof BUSINESS_EVENT_TYPES];

export type BusinessEntityType =
  | 'business'
  | 'process'
  | 'automation'
  | 'memory'
  | 'document'
  | 'content'
  | 'metric'
  | 'chat'
  | 'personnel'
  | 'decision';

export type OccurredAtPrecision = 'exact' | 'approximate' | 'unknown';

export type BusinessEventIngestion = 'live' | 'backfill' | 'import';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface BusinessEventMetadata {
  changes?: FieldChange[];
  preview?: string;
  role?: string;
  kind?: 'human' | 'agent';
  businessName?: string;
  profileKey?: string;
  count?: number;
  status?: string;
  type?: string;
  planReady?: boolean;
  parentProcessId?: string;
  childProcessId?: string;
  decisionId?: string;
  title?: string;
  statement?: string;
  rationale?: string | null;
  context?: string | null;
  decidedAt?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  supersededByDecisionId?: string | null;
  supersededDecisionId?: string;
  documentKind?: string;
  documentSlug?: string;
  pinnedForContext?: boolean;
  /** Hired agent assigned to an automation (4.10). */
  agentId?: string;
  agentName?: string;
  previousAgentId?: string;
  /** Decision record / request kind (4.12 HITL). */
  decisionKind?: string;
  requestId?: string;
}

export interface RecordBusinessEventInput {
  businessId: string;
  userId?: string | null;
  type: BusinessEventType | string;
  entityType?: BusinessEntityType | null;
  entityId?: string | null;
  entityName?: string | null;
  summary: string;
  metadata?: BusinessEventMetadata | null;
  occurredAt?: Date | null;
  occurredAtPrecision?: OccurredAtPrecision;
  ingestion?: BusinessEventIngestion;
}

export interface BusinessEventRecord {
  id: string;
  businessId: string;
  userId: string | null;
  sequence: number;
  type: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  summary: string;
  metadata: string | null;
  recordedAt: string;
  occurredAt: string | null;
  occurredAtPrecision: string;
  ingestion: string;
}

export type BusinessLogFilter =
  | 'all'
  | 'business'
  | 'process'
  | 'automation'
  | 'chat'
  | 'memory'
  | 'document'
  | 'content'
  | 'metric'
  | 'personnel'
  | 'decision';

export function eventCategory(type: string): BusinessLogFilter {
  const prefix = type.split('.')[0];
  if (
    prefix === 'business' ||
    prefix === 'process' ||
    prefix === 'automation' ||
    prefix === 'chat' ||
    prefix === 'memory' ||
    prefix === 'document' ||
    prefix === 'content' ||
    prefix === 'metric' ||
    prefix === 'personnel' ||
    prefix === 'decision'
  ) {
    return prefix;
  }
  return 'all';
}

export function resolveOccurredAtPrecision(
  input: RecordBusinessEventInput,
  occurredAt: Date | null
): OccurredAtPrecision {
  if (input.occurredAtPrecision) return input.occurredAtPrecision;
  if (!occurredAt) return 'unknown';
  const ingestion = input.ingestion ?? 'live';
  if (ingestion === 'live') return 'exact';
  if (ingestion === 'import') return 'approximate';
  return 'approximate';
}