import { callHermes, parseJsonFromLlm, type HermesConfig } from './hermes';
import type { AutomationPlan, IntegrationRequirement } from './automation-types';
import type { CredentialMap } from './automation-types';

const WORKFLOW_SYSTEM = `You are an n8n workflow generator for Hermes Forge.

Given an approved business process map and automation plan, produce a valid n8n workflow JSON object.

Return ONLY JSON with this shape:
{
  "name": "Workflow name",
  "nodes": [ ... valid n8n node objects ... ],
  "connections": { ... n8n connections object ... },
  "settings": {}
}

Rules:
- Workflow must be inactive-ready (do not set active)
- Use n8n node type strings like "n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.set", "n8n-nodes-base.httpRequest", "n8n-nodes-base.if"
- Each node needs: id (uuid-like string), name, type, typeVersion, position [x,y], parameters
- Prefer Schedule Trigger for schedule-based plans; Webhook node for webhook plans
- Include a Set node that documents automatable steps from the plan
- For integrations with mapped credentials, attach credentials on nodes using { "credentialType": { "id": "...", "name": "..." } }
- Keep workflows minimal but runnable — 3-6 nodes is fine for v1
- Do not include secrets in parameters — only credential references`;

export interface GeneratedN8nWorkflow {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export async function generateN8nWorkflow(
  config: HermesConfig,
  context: {
    processName: string;
    description: string;
    trigger: string | null;
    diagramMermaid: string | null;
    plan: AutomationPlan;
    integrations: IntegrationRequirement[];
    credentialMap: CredentialMap;
  }
): Promise<GeneratedN8nWorkflow> {
  const userContent = [
    `Process: ${context.processName}`,
    `Description: ${context.description || 'N/A'}`,
    `Trigger: ${context.trigger || 'N/A'}`,
    context.diagramMermaid ? `Diagram:\n${context.diagramMermaid}` : '',
    `\nAutomation plan:\n${JSON.stringify(context.plan, null, 2)}`,
    `\nIntegrations:\n${JSON.stringify(context.integrations, null, 2)}`,
    `\nCredential map (reference only):\n${JSON.stringify(context.credentialMap, null, 2)}`,
    '\nGenerate the n8n workflow JSON now.',
  ]
    .filter(Boolean)
    .join('\n');

  const content = await callHermes(
    config,
    [
      { role: 'system', content: WORKFLOW_SYSTEM },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.15 }
  );

  const raw = parseJsonFromLlm(content) as GeneratedN8nWorkflow;
  if (!raw.name || !Array.isArray(raw.nodes) || !raw.connections) {
    throw new Error('Generated workflow JSON is missing required fields');
  }

  return {
    name: raw.name,
    nodes: raw.nodes,
    connections: raw.connections,
    settings: raw.settings ?? {},
  };
}