import { callHermes, parseJsonFromLlm, type HermesConfig } from './hermes';
import type { AutomationExtraction, AutomationPlan, IntegrationRequirement } from './automation-types';

/** Background extraction system role (also listed in prompt catalog). */
export const EXTRACTION_SYSTEM = `You are an automation plan extractor for Hermes Forge.

Given an approved process map and an automation design conversation, extract structured data.

Return ONLY valid JSON with this shape:
{
  "integrations": [
    { "name": "Gmail", "purpose": "Read inbound leads", "status": "needed" }
  ],
  "plan": {
    "summary": "One paragraph plan summary",
    "recommendedPath": "hermes_cron" | "n8n_workflow" | "undecided",
    "triggerType": "schedule" | "webhook" | "manual" | "event" | "undecided",
    "schedule": "every 1d at 09:00" or null,
    "deliveryChannel": "telegram" | "slack" | "email" | null,
    "automatableSteps": ["step 1", "step 2"],
    "manualSteps": ["step that stays human"],
    "reasoning": "Why this path was chosen"
  },
  "planReady": false
}

Set planReady to true only when the conversation has a clear recommended path, trigger/schedule, and the user has enough detail to deploy.
Be conservative — if key decisions are still open, planReady must be false.
Integration status is always "needed" unless the user explicitly said they already configured it (then "configured").`;

function normalizeExtraction(raw: unknown): AutomationExtraction {
  const data = raw as Partial<AutomationExtraction>;
  const plan = data.plan ?? ({} as Partial<AutomationPlan>);

  return {
    integrations: Array.isArray(data.integrations)
      ? data.integrations.map((item) => ({
          name: String((item as IntegrationRequirement).name ?? 'Unknown'),
          purpose: String((item as IntegrationRequirement).purpose ?? ''),
          status: (item as IntegrationRequirement).status === 'configured' ? 'configured' : 'needed',
        }))
      : [],
    plan: {
      summary: String(plan.summary ?? ''),
      recommendedPath:
        plan.recommendedPath === 'hermes_cron' || plan.recommendedPath === 'n8n_workflow'
          ? plan.recommendedPath
          : 'undecided',
      triggerType:
        plan.triggerType === 'schedule' ||
        plan.triggerType === 'webhook' ||
        plan.triggerType === 'manual' ||
        plan.triggerType === 'event'
          ? plan.triggerType
          : 'undecided',
      schedule: plan.schedule ?? null,
      deliveryChannel: plan.deliveryChannel ?? null,
      automatableSteps: Array.isArray(plan.automatableSteps)
        ? plan.automatableSteps.map(String)
        : [],
      manualSteps: Array.isArray(plan.manualSteps) ? plan.manualSteps.map(String) : [],
      reasoning: plan.reasoning ?? undefined,
    },
    planReady: Boolean(data.planReady),
  };
}

export async function extractAutomationPlan(
  config: HermesConfig,
  context: {
    processName: string;
    description: string;
    trigger: string | null;
    manualSteps: string | null;
    diagramMermaid: string | null;
    conversation: { role: string; content: string }[];
  }
): Promise<AutomationExtraction> {
  const userContent = [
    `Process: ${context.processName}`,
    `Description: ${context.description || 'N/A'}`,
    `Trigger: ${context.trigger || 'N/A'}`,
    `Manual steps: ${context.manualSteps || 'N/A'}`,
    context.diagramMermaid ? `Diagram:\n${context.diagramMermaid}` : '',
    '\nAutomation design conversation:\n',
    context.conversation.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
    '\nExtract the current automation plan and integrations.',
  ]
    .filter(Boolean)
    .join('\n');

  const content = await callHermes(
    config,
    [
      { role: 'system', content: EXTRACTION_SYSTEM },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.1 }
  );

  return normalizeExtraction(parseJsonFromLlm(content));
}