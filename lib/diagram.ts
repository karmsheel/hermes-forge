import { callHermes, type HermesConfig } from './hermes';
import { sanitizeMermaidSource } from './mermaid-sanitize';
import {
  getProcessStandard,
  resolveProcessStandard,
  type ProcessStandardId,
} from './process-standards';

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

export async function generateDiagramMermaid(
  config: HermesConfig,
  processName: string,
  processDescription: string,
  conversation: { role: string; content: string }[],
  currentDiagram: string | null,
  processStandard?: ProcessStandardId
): Promise<string> {
  const standardId = processStandard ?? resolveProcessStandard(processDescription);
  const standard = getProcessStandard(standardId);

  const context = [
    `Process name: ${processName}`,
    `Description: ${processDescription || 'Not yet described'}`,
    currentDiagram ? `\nCurrent diagram (update this incrementally):\n${currentDiagram}` : '\nNo diagram yet — create an initial skeleton.',
    '\nConversation:\n' + conversation.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
    '\nOutput the complete updated Mermaid diagram now.',
  ].join('\n');

  const content = await callHermes(
    config,
    [
      { role: 'system', content: `${DIAGRAM_SYSTEM_PROMPT}\n\n${standard.diagramPromptAddon}` },
      { role: 'user', content: context },
    ],
    { temperature: 0.2 }
  );

  return sanitizeMermaidSource(content);
}

export function buildChatSystemPrompt(context: {
  processName: string;
  description: string;
  nameStatus: string;
  processStandard?: ProcessStandardId;
}): string {
  const standardId = context.processStandard ?? resolveProcessStandard(context.description);
  const standard = getProcessStandard(standardId);

  const namingNote =
    context.nameStatus === 'pending' && !/^untitled/i.test(context.processName)
      ? `\nThe workflow was auto-named "${context.processName}". A separate message may ask the user to confirm the name — do not repeat the naming question if that message was already sent. If the user wants a different name, accept it graciously.`
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
${namingNote}

${standard.chatPromptAddon}

If this is the start of a new process, welcome them and ask what process they want to map and what triggers it.`;
}