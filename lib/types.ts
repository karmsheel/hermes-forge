import type { AutomationDeployStatus } from './process-status';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { businesses: number };
}

export interface Business {
  id: string;
  userId?: string;
  name: string;
  industry: string | null;
  description: string | null;
  teamSize: number | null;
  website: string | null;
  goals: string | null;
  constraints: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSummary {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { processes: number };
}

export interface Process {
  id: string;
  businessId: string;
  name: string;
  description: string;
  department: string;
  trigger: string | null;
  inputs: string | null;
  outputs: string | null;
  manualSteps: string | null;
  automationScore: number;
  estimatedTimeSaved: number | null;
  repetition: number | null;
  businessValue: number | null;
  complexity: number | null;
  status: string;
  approvedAt: string | null;
  nameStatus: string;
  diagramMermaid: string | null;
  diagramUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  processId: string;
  conversationId: string | null;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  processId: string;
  title: string;
  forkedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface ProcessSummary {
  id: string;
  name: string;
  description: string;
  department: string;
  status: string;
  approvedAt: string | null;
  nameStatus: string;
  diagramMermaid: string | null;
  diagramUpdatedAt: string | null;
  updatedAt: string;
  createdAt: string;
  _count: { messages: number };
}

export interface ApprovedProcessSummary extends ProcessSummary {
  automationStatus: AutomationDeployStatus;
}

export interface ProcessWithMessages extends Process {
  messages: ChatMessage[];
  conversations?: Conversation[];
  business?: { id: string; name: string };
}

export interface Memory {
  id: string;
  businessId: string;
  fact: string;
  confidence: number;
  source: string | null;
  lastUpdated: string;
}

export interface HermesConfig {
  baseUrl: string; // e.g. http://localhost:8642
  apiKey: string;
  model?: string;
}

export interface N8nConfig {
  baseUrl: string; // e.g. http://127.0.0.1:5678
  apiKey: string;
}

export interface N8nConnectionStatus {
  state: 'idle' | 'testing' | 'connected' | 'error';
  latencyMs?: number;
  error?: string;
}

export interface N8nCredentialSummary {
  id: string;
  name: string;
  type: string;
}

export type HermesConnectionState =
  | 'idle'
  | 'discovering'
  | 'testing'
  | 'connected'
  | 'error';

export type HermesConnectionKind =
  | 'reachable'
  | 'auth_failed'
  | 'not_running'
  | 'timeout'
  | 'misconfigured';

export interface HermesConnectionStatus {
  state: HermesConnectionState;
  baseUrl?: string;
  latencyMs?: number;
  model?: string;
  features?: string[];
  error?: string;
  kind?: HermesConnectionKind;
  source?: 'auto' | 'manual' | 'saved';
  checkedAt?: string;
}

export type Department = 
  | 'Sales' 
  | 'Marketing' 
  | 'Customer Service' 
  | 'Revenue' 
  | 'Manufacturing' 
  | 'Operations' 
  | 'Finance' 
  | 'Support' 
  | 'HR' 
  | 'Custom';

export interface BusinessExportPayload {
  version: 1;
  exportedAt: string;
  business: {
    name: string;
    description: string | null;
    industry: string | null;
  };
  processes: Array<{
    name: string;
    description: string;
    department: string;
    trigger: string | null;
    inputs: string | null;
    outputs: string | null;
    manualSteps: string | null;
    diagramMermaid: string | null;
    messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>;
  }>;
  memories?: Array<{ fact: string; confidence?: number; source?: string | null }>;
}
