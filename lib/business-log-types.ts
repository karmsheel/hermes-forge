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

  MEMORY_FACT_ADDED: 'memory.fact_added',
} as const;

export type BusinessEventType =
  (typeof BUSINESS_EVENT_TYPES)[keyof typeof BUSINESS_EVENT_TYPES];

export type BusinessEntityType =
  | 'business'
  | 'process'
  | 'automation'
  | 'memory'
  | 'chat';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface BusinessEventMetadata {
  changes?: FieldChange[];
  preview?: string;
  role?: string;
  count?: number;
  status?: string;
  type?: string;
  planReady?: boolean;
  parentProcessId?: string;
  childProcessId?: string;
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
  source?: 'live' | 'backfill';
  createdAt?: Date;
}

export interface BusinessEventRecord {
  id: string;
  businessId: string;
  userId: string | null;
  type: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  summary: string;
  metadata: string | null;
  source: string;
  createdAt: string;
}

export type BusinessLogFilter =
  | 'all'
  | 'business'
  | 'process'
  | 'automation'
  | 'chat'
  | 'memory';

export function eventCategory(type: string): BusinessLogFilter {
  const prefix = type.split('.')[0];
  if (
    prefix === 'business' ||
    prefix === 'process' ||
    prefix === 'automation' ||
    prefix === 'chat' ||
    prefix === 'memory'
  ) {
    return prefix;
  }
  return 'all';
}