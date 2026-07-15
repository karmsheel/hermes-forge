import type { AutomationAgentSummary, AutomationPlan } from './automation-types';
import { buildContentIngestUrl } from './content-ingest';

export type CronPromptIngestOptions = {
  /** Absolute Forge origin, e.g. http://127.0.0.1:3000 */
  forgeBaseUrl: string;
  /** Bearer token stored on Automation.ingestToken */
  ingestToken: string;
};

export function buildCronPrompt(
  process: {
    name: string;
    description: string;
    trigger: string | null;
    manualSteps: string | null;
    diagramMermaid: string | null;
  },
  plan: AutomationPlan,
  agent?: AutomationAgentSummary | null,
  ingest?: CronPromptIngestOptions | null
): string {
  const steps =
    plan.automatableSteps.length > 0
      ? plan.automatableSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : plan.summary;

  const manual =
    plan.manualSteps.length > 0
      ? `\n\nSteps that remain manual:\n${plan.manualSteps.map((s) => `- ${s}`).join('\n')}`
      : '';

  const diagram = process.diagramMermaid
    ? `\n\nProcess diagram (Mermaid):\n${process.diagramMermaid}`
    : '';

  const agentBlock = agent
    ? [
        '',
        `You are operating as hired Hermes agent "${agent.displayName}" (profile: ${agent.profileKey}).`,
        agent.description ? `Agent role: ${agent.description}` : null,
        agent.model ? `Preferred model: ${agent.model}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const ingestBlock = ingest
    ? [
        '',
        '=== Hermes Forge Content handoff (required when you produce ideas/drafts) ===',
        'After producing content, POST each piece into the Forge Content inventory so the owner can review it.',
        `POST ${buildContentIngestUrl(ingest.forgeBaseUrl)}`,
        'Headers:',
        '  Content-Type: application/json',
        `  Authorization: Bearer ${ingest.ingestToken}`,
        'Body JSON (one piece per request):',
        '{',
        '  "title": "Short headline",',
        '  "bodyMarkdown": "Full draft in markdown",',
        '  "status": "review",',
        '  "channel": "linkedin" | "x" | "newsletter" | "blog" | "other" | null',
        '}',
        'Rules:',
        '- Use status "review" for drafts that need human approval (default).',
        '- Use status "idea" only for short topic seeds without a full draft.',
        '- Do not claim external publish unless you actually posted via tools.',
        '- If HTTP tools are unavailable, still structure the deliver message as:',
        '  TITLE: ...',
        '  BODY:',
        '  ...markdown...',
        '  so the owner can paste it via Automations → Simulate content handoff.',
        '=== end Content handoff ===',
      ].join('\n')
    : [
        '',
        'Content inventory (Hermes Forge): When this process produces ideas or drafts,',
        'structure your output as a titled markdown piece the owner can paste into the',
        'Forge Content inventory (status: idea → draft → review → ready → shipped).',
        'Prefer clear title + body. Do not claim you published externally unless you',
        'actually did via available tools.',
      ].join('\n');

  return [
    `You are executing a scheduled automation for the business process "${process.name}".`,
    agentBlock,
    '',
    `Process description: ${process.description || 'N/A'}`,
    `Trigger context: ${process.trigger || plan.triggerType}`,
    '',
    `Automation goal: ${plan.summary}`,
    '',
    'Automate these steps on each run:',
    steps,
    manual,
    diagram,
    ingestBlock,
    '',
    'Follow the steps precisely. If nothing needs attention, respond with [SILENT].',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function defaultCronSchedule(plan: AutomationPlan): string {
  return plan.schedule?.trim() || 'every 1d at 09:00';
}

export function defaultCronDeliver(plan: AutomationPlan): string {
  return plan.deliveryChannel?.trim() || 'local';
}

export function slugifyJobName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
