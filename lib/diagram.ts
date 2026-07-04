import { callHermes, type HermesConfig } from './hermes';
import { sanitizeMermaidSource } from './mermaid-sanitize';
import {
  getProcessStandard,
  resolveProcessStandard,
  type ProcessStandardId,
} from './process-standards';
import {
  formatDiscoveryContext,
  type ProcessDiscoveryFields,
} from './process-discovery';

const DIAGRAM_SYSTEM_PROMPT = `You are a business process diagrammer for Hermes Forge.

Given a conversation about ONE business process, produce or update a Mermaid flowchart that visualizes the process at the current level of understanding.

Rules:
- Return ONLY valid Mermaid syntax. No markdown fences, no explanation.
- Use "flowchart TD" as the diagram type unless notation rules specify otherwise.
- Keep node labels short (max ~6 words).
- Use rectangles for steps, diamonds for decisions, rounded boxes for start/end.
- Add new nodes and edges as new information appears; refine labels when the user corrects you.
- If the process is barely started, show a minimal skeleton (trigger → first step → ?).
- Use semantic node IDs like trigger, step1, decision1 — not random letters.
- NEVER use reserved words as node IDs: end, subgraph, graph, class, style. Use finish, done, or complete instead of end.
- Keep labels simple: letters, numbers, spaces only. No parentheses, quotes, or colons in labels.

Example output:
flowchart TD
  start([New lead arrives]) --> qualify{Qualified?}
  qualify -->|Yes| demo[Schedule demo]
  qualify -->|No| archive[Archive lead]
  demo --> close{Won deal?}
  close -->|Yes| onboard[Onboard customer]
  close -->|No| nurture[Add to nurture list]`;

export interface DiagramGenerationInput {
  processName: string;
  processDescription: string;
  conversation: { role: string; content: string }[];
  currentDiagram: string | null;
  processStandard?: ProcessStandardId;
  discovery?: ProcessDiscoveryFields;
}

export function buildDiagramMessages(input: DiagramGenerationInput): {
  role: string;
  content: string;
}[] {
  const standardId =
    input.processStandard ?? resolveProcessStandard(input.processDescription);
  const standard = getProcessStandard(standardId);

  const discoveryBlock = input.discovery
    ? formatDiscoveryContext(input.discovery)
    : null;

  const context = [
    `Process name: ${input.processName}`,
    `Description: ${input.processDescription || 'Not yet described'}`,
    discoveryBlock ? `\n${discoveryBlock}` : '',
    input.currentDiagram
      ? `\nCurrent diagram (update this incrementally):\n${input.currentDiagram}`
      : '\nNo diagram yet — create an initial skeleton.',
    '\nConversation:\n' +
      input.conversation.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
    '\nOutput the complete updated Mermaid diagram now.',
  ].join('\n');

  return [
    {
      role: 'system',
      content: `${DIAGRAM_SYSTEM_PROMPT}\n\n${standard.diagramPromptAddon}`,
    },
    { role: 'user', content: context },
  ];
}

export async function generateDiagramMermaid(
  config: HermesConfig,
  input: DiagramGenerationInput,
): Promise<string> {
  const content = await callHermes(config, buildDiagramMessages(input), {
    temperature: 0.2,
  });

  return sanitizeMermaidSource(content);
}

export function buildChatSystemPrompt(context: {
  processName: string;
  description: string;
  nameStatus: string;
  processStandard?: ProcessStandardId;
  status: string;
  hasDiagram: boolean;
  shouldAskAccuracy: boolean;
  discovery?: ProcessDiscoveryFields;
}): string {
  const standardId = context.processStandard ?? resolveProcessStandard(context.description);
  const standard = getProcessStandard(standardId);

  const namingNote =
    context.nameStatus === 'pending' && !/^untitled/i.test(context.processName)
      ? `\nThe workflow was auto-named "${context.processName}". A separate message may ask the user to confirm the name — do not repeat the naming question if that message was already sent. If the user wants a different name, accept it graciously.`
      : '';

  const approvedNote =
    context.status === 'approved'
      ? `\nThis process map is APPROVED for automation. Do not ask mapping questions — if the user wants changes, help them refine the map and remind them they can re-approve when ready. You may mention they can open Automations to design the automation.`
      : '';

  const discoveryBlock = context.discovery
    ? formatDiscoveryContext(context.discovery)
    : null;
  const discoveryNote = discoveryBlock
    ? `\nThe user has already answered structured discovery questions. Use these as ground truth and avoid re-asking the same facts unless they contradict the chat:\n${discoveryBlock}\n`
    : '\nIf key facts are missing (trigger, systems, manual steps, output), you may ask the user to fill in the Questions tab or answer in chat — one question at a time.\n';

  const accuracyNote = context.shouldAskAccuracy
    ? `\nThe diagram has enough detail now. In this reply, after your normal response, ask ONE clear question: "Does this diagram accurately represent how this process works in your business?" Do not mention automation or n8n yet — only accuracy of the map.`
    : context.hasDiagram
      ? `\nA diagram exists but may still need more detail. Keep mapping — do not ask about accuracy until the flow is substantially complete.`
      : '';

  return `You are Hermes, an expert Business Process Analyst for Hermes Forge.

You are helping the user map ONE specific business process through conversation. A live Mermaid diagram updates in the background as you learn more — the user can see it and give corrections.

Your goals:
- Understand the trigger, actors, steps, decisions, tools, inputs, and outputs for this process
- Ask one focused follow-up question at a time when information is missing
- Acknowledge corrections gracefully and update your mental model
- Keep responses concise (2-4 sentences max)
- When the user describes steps, confirm your understanding briefly

Do NOT output Mermaid or diagram syntax in your replies — a diagram subagent handles that separately.
Do NOT mention subagents, background tasks, or automation — stay conversational.
Do NOT mention n8n yet — this is pure process discovery.

Workflow splitting (important):
- Each workflow in Hermes Forge must be ONE automatable flow (single trigger → one coherent path).
- If the map has multiple independent triggers, parallel unrelated streams, or clearly separate subprocesses, propose splitting the peeled-off flow into its own workflow.
- Ask clearly: "Should I split [name the flow] into its own workflow?" — wait for the user to confirm before assuming the split happened.
- If the user asks to split, separate, or break apart flows, acknowledge and confirm which flow goes where.
- After a split, the sidebar will show a new workflow — tell the user to check the left panel.

${namingNote}${approvedNote}${discoveryNote}${accuracyNote}

${standard.chatPromptAddon}

If this is the start of a new process, welcome them and ask what process they want to map and what triggers it.`;
}