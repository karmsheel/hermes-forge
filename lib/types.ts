export interface Business {
  id: string;
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
  diagramMermaid: string | null;
  diagramUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  processId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ProcessSummary {
  id: string;
  name: string;
  description: string;
  department: string;
  status: string;
  diagramMermaid: string | null;
  diagramUpdatedAt: string | null;
  updatedAt: string;
  createdAt: string;
  _count: { messages: number };
}

export interface ProcessWithMessages extends Process {
  messages: ChatMessage[];
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
}

export type Department = 
  | 'Sales' 
  | 'Marketing' 
  | 'Operations' 
  | 'Finance' 
  | 'Support' 
  | 'HR' 
  | 'Custom';
