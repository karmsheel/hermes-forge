import type { ProcessStandardId } from "@/lib/process-standards";
import type { WorkflowTemplateId } from "@/lib/workflow-templates";
import {
  clearLegacyActiveProcessId,
  setActiveProcessId,
  setPendingHermesReply,
} from "@/lib/workshop-storage";

export interface StartFromBriefOptions {
  templateId?: WorkflowTemplateId;
  processName?: string;
  diagramMermaid?: string;
  processStandard?: ProcessStandardId;
}

export interface StartFromBriefResult {
  businessId: string;
  processId: string;
}

export async function startFromBrief(
  brief: string,
  options: StartFromBriefOptions = {}
): Promise<StartFromBriefResult> {
  const trimmed = brief.trim();
  if (!trimmed) throw new Error("Brief is required");

  const res = await fetch("/api/start-from-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brief: trimmed,
      templateId: options.templateId,
      processName: options.processName,
      diagramMermaid: options.diagramMermaid,
      processStandard: options.processStandard,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to start from brief");
  }

  const data = await res.json();
  clearLegacyActiveProcessId();
  setActiveProcessId(data.businessId, data.processId);
  setPendingHermesReply(data.processId);

  return { businessId: data.businessId, processId: data.processId };
}