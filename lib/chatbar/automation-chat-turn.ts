/**
 * Shared automation design chat turn — streams Hermes like process/studio chat.
 */

import { buildAutomationChatSystemPrompt } from "@/lib/automation-chat";
import {
  parseAutomationPlan,
  parseIntegrations,
  type AutomationPlan,
  type IntegrationRequirement,
} from "@/lib/automation-types";
import { hermesSessionCallOptions } from "@/lib/chatbar/session-headers";
import {
  fetchHermesRunUsage,
  streamHermesEvents,
  type HermesStreamEvent,
} from "@/lib/hermes-stream";
import type { NormalizedHermesUsage } from "@/lib/chatbar/usage";
import type { HermesConfig } from "@/lib/hermes";

export type AutomationChatTurnInput = {
  process: {
    id: string;
    businessId: string;
    name: string;
    description: string;
    department: string;
    trigger: string | null;
    inputs: string | null;
    outputs: string | null;
    manualSteps: string | null;
    diagramMermaid: string | null;
  };
  automationId: string;
  userId: string;
  messages: { role: string; content: string }[];
  hermes: HermesConfig;
  existingPlan: AutomationPlan | null;
  existingIntegrations: IntegrationRequirement[];
  assignedAgentName?: string | null;
  agentProfileKey?: string | null;
  signal?: AbortSignal;
};

export type AutomationChatStreamEvent =
  | HermesStreamEvent
  | {
      type: "done";
      assistantContent: string;
      usage: NormalizedHermesUsage | null;
      runId: string | null;
    };

export function buildAutomationChatHermesMessages(input: {
  process: AutomationChatTurnInput["process"];
  messages: { role: string; content: string }[];
  existingPlan: AutomationPlan | null;
  existingIntegrations: IntegrationRequirement[];
  assignedAgentName?: string | null;
}): { role: string; content: string }[] {
  const { process, messages, existingPlan, existingIntegrations, assignedAgentName } =
    input;
  return [
    {
      role: "system",
      content: buildAutomationChatSystemPrompt({
        processName: process.name,
        description: process.description,
        department: process.department,
        trigger: process.trigger,
        inputs: process.inputs,
        outputs: process.outputs,
        manualSteps: process.manualSteps,
        diagramMermaid: process.diagramMermaid,
        existingPlan,
        existingIntegrations,
        assignedAgentName: assignedAgentName ?? null,
      }),
    },
    {
      role: "system",
      content: `Process map: "${process.name}" — ${process.description || "No description"}`,
    },
    ...messages,
  ];
}

export async function* streamAutomationChatTurn(
  input: AutomationChatTurnInput,
): AsyncGenerator<AutomationChatStreamEvent> {
  const hermesMessages = buildAutomationChatHermesMessages({
    process: input.process,
    messages: input.messages,
    existingPlan: input.existingPlan,
    existingIntegrations: input.existingIntegrations,
    assignedAgentName: input.assignedAgentName,
  });

  const sessionOpts = hermesSessionCallOptions({
    userId: input.userId,
    businessId: input.process.businessId,
    agentProfileKey: input.agentProfileKey ?? null,
    conversationId: `automation:${input.automationId}`,
  });

  let assistantText = "";
  let runId: string | null = null;
  let lastUsage: NormalizedHermesUsage | null = null;

  for await (const event of streamHermesEvents(input.hermes, hermesMessages, {
    signal: input.signal,
    sessionKey: sessionOpts.sessionKey,
    sessionId: sessionOpts.sessionId,
  })) {
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

  yield {
    type: "done",
    assistantContent:
      assistantText.trim() ||
      "Tell me more about which steps you want to automate first.",
    usage: lastUsage,
    runId,
  };
}

// Re-export parsers for route convenience
export { parseAutomationPlan, parseIntegrations };
