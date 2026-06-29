import { callHermes, parseJsonFromLlm, type HermesConfig } from './hermes';

const UNTITLED_PATTERN = /^untitled(\s+process)?$/i;

export function isUntitledProcessName(name: string): boolean {
  return UNTITLED_PATTERN.test(name.trim());
}

const NAMING_SYSTEM_PROMPT = `You are a workflow naming specialist for Hermes Forge.

Given a conversation about a business process, propose ONE concise workflow name.

Rules:
- 2-5 words, title case
- Describe what the process does, not generic labels
- No quotes, no punctuation at the end
- Return ONLY JSON: { "name": string }`;

export async function suggestProcessName(
  config: HermesConfig,
  conversation: { role: string; content: string }[]
): Promise<string> {
  const userMessages = conversation.filter((m) => m.role === 'user');
  if (userMessages.length === 0) {
    throw new Error('No user messages to name from');
  }

  const content = await callHermes(
    config,
    [
      { role: 'system', content: NAMING_SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          'Conversation:\n\n' +
          conversation.map((m) => `${m.role}: ${m.content}`).join('\n\n') +
          '\n\nPropose the workflow name now.',
      },
    ],
    { temperature: 0.3 }
  );

  try {
    const parsed = parseJsonFromLlm(content) as { name?: string };
    const name = parsed.name?.trim();
    if (name && name.length >= 2 && name.length <= 80) return name;
  } catch {
    // fall through to line parse
  }

  const line = content.replace(/```json\n?|\n?```/g, '').trim().split('\n')[0]?.trim();
  if (line && line.length >= 2 && line.length <= 80) {
    return line.replace(/^["']|["']$/g, '');
  }

  throw new Error('Failed to generate process name');
}