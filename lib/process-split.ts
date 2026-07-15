import { prisma } from '@/lib/prisma';
import { callHermes, parseJsonFromLlm, type HermesConfig } from '@/lib/hermes';
import { sanitizeMermaidSource } from '@/lib/mermaid-sanitize';
import { categorizeWorkflow } from '@/lib/categorize-workflow';
import { WELCOME_MESSAGE } from '@/lib/process-welcome';
import {
  analyzeSplitCandidates,
  formatSplitAnalysisForPrompt,
  type SplitAnalysis,
} from '@/lib/mermaid-graph';
import { deriveIoShape } from '@/lib/io-shape';

const SPLIT_PROPOSAL =
  /split (this |it )?(into|out)|separate workflow|own workflow|two (distinct |separate )?(process|workflow)|multiple (distinct )?flow|parallel (process|flow|stream)|should be (its own|a separate)|peel off|break (this |it )?(into|out)/i;

const SPLIT_REQUEST =
  /split (this|it|them|out|into)|separate (this|into|them|out)|break (this |it )?(into|out|apart)|divide (this |it )?(into|two)|two (separate )?workflows?|multiple workflows?/i;

const SPLIT_CONFIRM_AFFIRMATIVE =
  /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|please do|sounds good)\b/i;

const SPLIT_CONFIRM_LOOSE =
  /\b(yes|split it|split them|go ahead|please split|do the split|separate them)\b/i;

const SPLIT_DECLINE = /\b(no[,!.\s]|not yet|don't split|do not split|keep (it |them )?together)\b/i;

export function assistantProposedSplit(content: string): boolean {
  return SPLIT_PROPOSAL.test(content);
}

export function userRequestsSplit(content: string): boolean {
  return SPLIT_REQUEST.test(content.trim());
}

export function userConfirmsSplit(content: string): boolean {
  const trimmed = content.trim();
  if (SPLIT_DECLINE.test(trimmed)) return false;
  return SPLIT_CONFIRM_AFFIRMATIVE.test(trimmed) || SPLIT_CONFIRM_LOOSE.test(trimmed);
}

export function shouldExecuteSplit(input: {
  userContent: string;
  lastAssistantContent?: string;
  /** Kept for call-site compatibility; forged processes may be split. */
  status: string;
}): boolean {
  if (userRequestsSplit(input.userContent)) return true;

  return Boolean(
    input.lastAssistantContent &&
      assistantProposedSplit(input.lastAssistantContent) &&
      userConfirmsSplit(input.userContent)
  );
}

/** True when split should reopen the parent out of forged/approved state. */
export function isForgedOrApprovedStatus(status: string): boolean {
  return status === 'approved' || status === 'forged';
}

/** Structural analysis of a process diagram for split UI + agent context. */
export function analyzeProcessSplit(
  diagramMermaid: string | null | undefined,
  status?: string
): SplitAnalysis {
  const analysis = analyzeSplitCandidates(diagramMermaid);
  if (status && isForgedOrApprovedStatus(status) && analysis.canSplit) {
    return {
      ...analysis,
      reasons: [
        ...analysis.reasons,
        'This process is forged — splitting will reopen it as draft so you can re-forge after review.',
      ],
    };
  }
  return analysis;
}

const SPLIT_PLAN_PROMPT = `You are a business process architect for Hermes Forge.

The user is refining a workflow that has grown into MULTIPLE independent flows. Split it into TWO single-flow workflows so each can be automated separately (n8n, cron, etc.).

Rules:
- Each workflow must have ONE primary trigger and ONE coherent flow (decision branches inside one flow are fine).
- parent = the flow that stays in the original workflow (usually the primary/core path).
- child = the peeled-off secondary flow that becomes its own workflow.
- Both diagrams must be complete, valid Mermaid flowchart TD syntax.
- Remove the child's nodes and edges from the parent diagram — no duplicate flows.
- Keep node labels short. Use semantic IDs (not "end").
- Names should be specific (e.g. "Invoice Approval" not "Process 2").
- Prefer the structural candidate flows when provided; do not invent unrelated steps.

Return ONLY valid JSON (no markdown fences):

{
  "parent": {
    "name": "string",
    "description": "one sentence",
    "diagramMermaid": "flowchart TD\\n  ...",
    "assistantNote": "2-3 sentences explaining what remains in this workflow after the split"
  },
  "child": {
    "name": "string",
    "description": "one sentence",
    "diagramMermaid": "flowchart TD\\n  ...",
    "assistantNote": "2-3 sentences welcoming mapping of this peeled-off flow; mention what was split out"
  }
}`;

export interface ProcessSplitPlan {
  parent: {
    name: string;
    description: string;
    diagramMermaid: string;
    assistantNote: string;
  };
  child: {
    name: string;
    description: string;
    diagramMermaid: string;
    assistantNote: string;
  };
}

export function parseSplitPlan(raw: unknown): ProcessSplitPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const plan = raw as Record<string, unknown>;
  const parent = plan.parent as Record<string, unknown> | undefined;
  const child = plan.child as Record<string, unknown> | undefined;

  if (!parent || !child) return null;

  const parentName = typeof parent.name === 'string' ? parent.name.trim() : '';
  const childName = typeof child.name === 'string' ? child.name.trim() : '';
  const parentDiagram = sanitizeMermaidSource(
    typeof parent.diagramMermaid === 'string' ? parent.diagramMermaid : ''
  );
  const childDiagram = sanitizeMermaidSource(
    typeof child.diagramMermaid === 'string' ? child.diagramMermaid : ''
  );

  if (!parentName || !childName || !parentDiagram || !childDiagram) return null;

  return {
    parent: {
      name: parentName,
      description:
        typeof parent.description === 'string' ? parent.description.trim() : '',
      diagramMermaid: parentDiagram,
      assistantNote:
        typeof parent.assistantNote === 'string'
          ? parent.assistantNote.trim()
          : `I've kept "${parentName}" as this workflow. The other flow is now a separate workflow in the sidebar.`,
    },
    child: {
      name: childName,
      description:
        typeof child.description === 'string' ? child.description.trim() : '',
      diagramMermaid: childDiagram,
      assistantNote:
        typeof child.assistantNote === 'string'
          ? child.assistantNote.trim()
          : `This workflow was split from "${parentName}" so each flow can be automated on its own.`,
    },
  };
}

export async function generateSplitPlan(
  config: HermesConfig,
  process: {
    name: string;
    description: string;
    diagramMermaid: string | null;
    messages: { role: string; content: string }[];
  },
  userInstruction: string
): Promise<ProcessSplitPlan> {
  const conversation = process.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  const analysis = analyzeSplitCandidates(process.diagramMermaid);
  const analysisBlock = formatSplitAnalysisForPrompt(analysis);

  const context = [
    `Current workflow name: ${process.name}`,
    `Description: ${process.description || 'Not yet described'}`,
    process.diagramMermaid
      ? `\nCurrent diagram:\n${process.diagramMermaid}`
      : '\nNo diagram yet.',
    analysisBlock ? `\n${analysisBlock}` : '',
    `\nConversation:\n${conversation || '(none)'}`,
    `\nUser instruction: ${userInstruction}`,
    '\nProduce the split plan JSON now.',
  ].join('\n');

  const content = await callHermes(
    config,
    [
      { role: 'system', content: SPLIT_PLAN_PROMPT },
      { role: 'user', content: context },
    ],
    { temperature: 0.2 }
  );

  const plan = parseSplitPlan(parseJsonFromLlm(content));
  if (!plan) {
    throw new Error('Could not generate a valid split plan. Try describing which flow to separate.');
  }

  return plan;
}

export interface ProcessSplitResult {
  parentProcessId: string;
  childProcessId: string;
  childName: string;
  parentName: string;
}

/** Persist an already-generated plan (no Hermes call). */
export async function applyProcessSplit(
  processId: string,
  plan: ProcessSplitPlan
): Promise<ProcessSplitResult> {
  const process = await prisma.process.findUnique({
    where: { id: processId },
  });

  if (!process) {
    throw new Error('Process not found');
  }

  const wasForged = isForgedOrApprovedStatus(process.status);
  const childDept = categorizeWorkflow(`${plan.child.name} ${plan.child.description}`);
  const childShape = deriveIoShape({
    diagramMermaid: plan.child.diagramMermaid,
    inputs: process.inputs,
    outputs: process.outputs,
  });
  const parentShape = deriveIoShape({
    diagramMermaid: plan.parent.diagramMermaid,
    inputs: process.inputs,
    outputs: process.outputs,
  });

  return prisma.$transaction(async (tx) => {
    const child = await tx.process.create({
      data: {
        businessId: process.businessId,
        name: plan.child.name,
        description: plan.child.description,
        department: childDept,
        status: 'draft',
        nameStatus: 'confirmed',
        diagramMermaid: plan.child.diagramMermaid,
        diagramUpdatedAt: new Date(),
        ioShape: childShape,
      },
    });

    await tx.process.update({
      where: { id: processId },
      data: {
        name: plan.parent.name,
        description: plan.parent.description,
        diagramMermaid: plan.parent.diagramMermaid,
        diagramUpdatedAt: new Date(),
        nameStatus: 'confirmed',
        ioShape: parentShape,
        // Diagram changed — reopen forged maps so automation is re-confirmed.
        ...(wasForged
          ? { status: 'draft', approvedAt: null }
          : {}),
      },
    });

    const reopenNote = wasForged
      ? `\n\nThis process was forged; I've reopened it as **draft** so you can review the remaining flow and re-forge when ready.`
      : '';

    await tx.chatMessage.create({
      data: {
        processId: processId,
        role: 'assistant',
        content: `${plan.parent.assistantNote}\n\nI've created a separate workflow "${plan.child.name}" in the sidebar — each flow is now isolated for automation.${reopenNote}`,
      },
    });

    await tx.chatMessage.create({
      data: {
        processId: child.id,
        role: 'assistant',
        content: WELCOME_MESSAGE,
      },
    });

    await tx.chatMessage.create({
      data: {
        processId: child.id,
        role: 'assistant',
        content: plan.child.assistantNote,
      },
    });

    return {
      parentProcessId: processId,
      childProcessId: child.id,
      childName: plan.child.name,
      parentName: plan.parent.name,
    };
  });
}

/**
 * Plan (Hermes) + apply. Used by chat intercept and simple POST apply without a pre-built plan.
 */
export async function executeProcessSplit(
  config: HermesConfig,
  processId: string,
  userInstruction: string,
  existingPlan?: ProcessSplitPlan
): Promise<ProcessSplitResult> {
  const process = await prisma.process.findUnique({
    where: { id: processId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!process) {
    throw new Error('Process not found');
  }

  const plan =
    existingPlan ??
    (await generateSplitPlan(config, process, userInstruction));

  return applyProcessSplit(processId, plan);
}

export async function planProcessSplit(
  config: HermesConfig,
  processId: string,
  userInstruction: string
): Promise<{ plan: ProcessSplitPlan; analysis: SplitAnalysis }> {
  const process = await prisma.process.findUnique({
    where: { id: processId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!process) {
    throw new Error('Process not found');
  }

  if (!process.diagramMermaid?.trim()) {
    throw new Error('Process has no diagram to split.');
  }

  const analysis = analyzeProcessSplit(process.diagramMermaid, process.status);
  const plan = await generateSplitPlan(
    config,
    process,
    userInstruction ||
      'Split into two single-flow workflows for automation. Prefer structural candidate flows.'
  );

  return { plan, analysis };
}

export { formatSplitAnalysisForPrompt, type SplitAnalysis };
