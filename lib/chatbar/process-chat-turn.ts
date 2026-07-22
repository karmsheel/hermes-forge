/**
 * Shared process-mapping chat turn (Workshop).
 * Streams Hermes like studio chat; side effects (accuracy forge, rename, etc.)
 * stay in the process chat route / callers.
 */

import { prisma } from "@/lib/prisma";
import { buildChatSystemPrompt } from "@/lib/diagram";
import {
  formatDiscoveryContext,
  pickDiscoveryFields,
} from "@/lib/process-discovery";
import { buildProcessMdFromBusiness } from "@/lib/process-md";
import { loadDocumentsForPrompt } from "@/lib/documents";
import { loadPersonnelRoster } from "@/lib/personnel/load-roster";
import {
  assistantAskedAccuracyQuestion,
  shouldPromptForAccuracy,
} from "@/lib/process-approval";
import {
  analyzeProcessSplit,
  formatSplitAnalysisForPrompt,
} from "@/lib/process-split";
import { extractSystemsFromFields } from "@/lib/systems";
import { hermesSessionCallOptions } from "@/lib/chatbar/session-headers";
import {
  fetchHermesRunUsage,
  streamHermesEvents,
  type HermesStreamEvent,
} from "@/lib/hermes-stream";
import type { NormalizedHermesUsage } from "@/lib/chatbar/usage";
import type { HermesConfig } from "@/lib/hermes";

export type ProcessChatMessage = { role: string; content: string };

export type ProcessChatTurnInput = {
  processId: string;
  userId: string;
  conversationId: string | null;
  /** Full history including the latest user message. */
  messages: ProcessChatMessage[];
  hermes: HermesConfig;
  /** Status after optional forge-from-chat this turn. */
  processStatus: string;
  approvedFromChat?: boolean;
  signal?: AbortSignal;
};

export type ProcessChatStreamEvent =
  | HermesStreamEvent
  | {
      type: "done";
      assistantContent: string;
      usage: NormalizedHermesUsage | null;
      runId: string | null;
    };

/**
 * Build Hermes messages (system + history) for a process mapping turn.
 */
export async function buildProcessChatHermesMessages(input: {
  process: {
    id: string;
    businessId: string;
    name: string;
    description: string;
    nameStatus: string;
    status: string;
    diagramMermaid: string | null;
    trigger: string | null;
    inputs: string | null;
    outputs: string | null;
    manualSteps: string | null;
    ioShape: string | null;
  };
  messages: ProcessChatMessage[];
  processStatus: string;
  approvedFromChat?: boolean;
}): Promise<{ role: string; content: string }[]> {
  const { process, messages, processStatus, approvedFromChat } = input;
  const messageCount = messages.length;
  const hasDiagram = Boolean(process.diagramMermaid?.trim());
  const recentAccuracyAsk = messages
    .slice(-4)
    .some(
      (m) =>
        m.role === "assistant" && assistantAskedAccuracyQuestion(m.content),
    );

  const discovery = pickDiscoveryFields({
    trigger: process.trigger,
    inputs: process.inputs,
    manualSteps: process.manualSteps,
    outputs: process.outputs,
  });
  const discoveryContext = formatDiscoveryContext(discovery);

  const businessSnapshot = await prisma.business.findUnique({
    where: { id: process.businessId },
    select: {
      name: true,
      description: true,
      industry: true,
      goals: true,
      constraints: true,
      processes: {
        select: {
          name: true,
          department: true,
          status: true,
          description: true,
          trigger: true,
          inputs: true,
          outputs: true,
          manualSteps: true,
          ioShape: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
      humanPersonnel: { select: { name: true, role: true } },
      hermesAgentProfiles: {
        where: { isHired: true },
        select: { displayName: true, description: true, isHired: true },
      },
    },
  });
  const processMd = businessSnapshot
    ? buildProcessMdFromBusiness(businessSnapshot)
    : null;

  const personnel = await loadPersonnelRoster(process.businessId);
  const knowledgeDocuments = await loadDocumentsForPrompt(
    process.businessId,
    prisma,
  );

  const splitAnalysis = analyzeProcessSplit(
    process.diagramMermaid,
    approvedFromChat ? "forged" : processStatus,
  );
  const splitAnalysisNote = formatSplitAnalysisForPrompt(splitAnalysis);

  const processSystems = extractSystemsFromFields({
    name: process.name,
    description: process.description,
    trigger: process.trigger,
    inputs: process.inputs,
    outputs: process.outputs,
    manualSteps: process.manualSteps,
  });

  return [
    {
      role: "system",
      content: buildChatSystemPrompt({
        processName: process.name,
        description: process.description,
        nameStatus: process.nameStatus,
        status: approvedFromChat ? "forged" : processStatus,
        hasDiagram,
        discovery,
        processMd,
        knowledgeDocuments,
        personnel,
        systems: processSystems,
        ioShape: process.ioShape,
        splitAnalysisNote: splitAnalysisNote || null,
        shouldAskAccuracy:
          !approvedFromChat &&
          processStatus !== "approved" &&
          processStatus !== "forged" &&
          !recentAccuracyAsk &&
          shouldPromptForAccuracy({
            status: processStatus,
            diagramMermaid: process.diagramMermaid,
            messageCount,
          }),
      }),
    },
    {
      role: "system",
      content: [
        `Current workflow: "${process.name}" — ${process.description || "Not yet described"}`,
        discoveryContext ?? "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    ...messages,
  ];
}

/**
 * Stream a process chat assistant reply via Hermes (same path as studio).
 * Caller persists the assistant message and reloads process after `done`.
 */
export async function* streamProcessChatTurn(
  input: ProcessChatTurnInput & {
    process: {
      id: string;
      businessId: string;
      name: string;
      description: string;
      nameStatus: string;
      status: string;
      diagramMermaid: string | null;
      trigger: string | null;
      inputs: string | null;
      outputs: string | null;
      manualSteps: string | null;
      ioShape: string | null;
    };
  },
): AsyncGenerator<ProcessChatStreamEvent> {
  const hermesMessages = await buildProcessChatHermesMessages({
    process: input.process,
    messages: input.messages,
    processStatus: input.processStatus,
    approvedFromChat: input.approvedFromChat,
  });

  const sessionOpts = hermesSessionCallOptions({
    userId: input.userId,
    businessId: input.process.businessId,
    agentProfileKey: null,
    conversationId: input.conversationId,
  });

  let assistantText = "";
  let runId: string | null = null;
  let lastUsage: NormalizedHermesUsage | null = null;

  for await (const event of streamHermesEvents(
    input.hermes,
    hermesMessages,
    {
      signal: input.signal,
      sessionKey: sessionOpts.sessionKey,
      sessionId: sessionOpts.sessionId,
    },
  )) {
    if (input.signal?.aborted) break;

    if (event.type === "run") {
      runId = event.runId;
      yield event;
      continue;
    }
    if (event.type === "tool") {
      yield event;
      continue;
    }
    if (event.type === "usage") {
      lastUsage = event.usage;
      yield event;
      continue;
    }
    if (event.type === "delta") {
      assistantText += event.text;
      yield event;
    }
  }

  if (!lastUsage && runId && !input.signal?.aborted) {
    const polled = await fetchHermesRunUsage(input.hermes, runId, {
      sessionKey: sessionOpts.sessionKey,
      sessionId: sessionOpts.sessionId,
    });
    if (polled) {
      lastUsage = polled;
      yield { type: "usage", usage: polled };
    }
  }

  const assistantContent =
    assistantText.trim() ||
    "Thanks — tell me more about the next step.";

  yield {
    type: "done",
    assistantContent,
    usage: lastUsage,
    runId,
  };
}

/** Collect full assistant text (non-SSE callers / tests). */
export async function collectProcessChatTurn(
  input: Parameters<typeof streamProcessChatTurn>[0],
): Promise<{
  assistantContent: string;
  usage: NormalizedHermesUsage | null;
  runId: string | null;
}> {
  let assistantContent = "";
  let usage: NormalizedHermesUsage | null = null;
  let runId: string | null = null;
  for await (const event of streamProcessChatTurn(input)) {
    if (event.type === "done") {
      assistantContent = event.assistantContent;
      usage = event.usage;
      runId = event.runId;
    }
  }
  return { assistantContent, usage, runId };
}
