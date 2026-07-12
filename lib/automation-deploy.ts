import type { AutomationAgentSummary, AutomationPlan } from './automation-types';

export function buildCronPrompt(
  process: {
    name: string;
    description: string;
    trigger: string | null;
    manualSteps: string | null;
    diagramMermaid: string | null;
  },
  plan: AutomationPlan,
  agent?: AutomationAgentSummary | null
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
    '',
    'Content inventory (Hermes Forge): When this process produces ideas or drafts,',
    'structure your output as a titled markdown piece the owner can paste into the',
    'Forge Content inventory (status: idea → draft → review → ready → shipped).',
    'Prefer clear title + body. Do not claim you published externally unless you',
    'actually did via available tools.',
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