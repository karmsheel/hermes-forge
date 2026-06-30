const ACCURACY_QUESTION =
  /accurately represent|does this (diagram|map)|happy with (the |this )?(map|diagram)|look right to you|capture.*correctly|represent how this process/i;

const AFFIRMATIVE =
  /^(yes|yeah|yep|yup|correct|accurate|looks good|that'?s right|that is right|perfect|spot on|exactly)\b/i;

const AFFIRMATIVE_LOOSE =
  /\b(yes|looks good|that'?s accurate|that'?s right|happy with it|approve|approved)\b/i;

const NEGATIVE = /\b(not yet|no[,!.\s]|not quite|needs? (more )?changes?|incorrect|wrong|missing)\b/i;

export function assistantAskedAccuracyQuestion(content: string): boolean {
  return ACCURACY_QUESTION.test(content);
}

export function userConfirmsAccuracy(content: string): boolean {
  const trimmed = content.trim();
  if (NEGATIVE.test(trimmed)) return false;
  return AFFIRMATIVE.test(trimmed) || AFFIRMATIVE_LOOSE.test(trimmed);
}

export function shouldPromptForAccuracy(context: {
  status: string;
  diagramMermaid: string | null;
  messageCount: number;
}): boolean {
  if (context.status === 'approved') return false;
  if (!context.diagramMermaid?.trim()) return false;
  // Enough conversation to have a meaningful diagram (user + assistant turns)
  return context.messageCount >= 4;
}