import type { BusinessExportPayload } from "./types";

/**
 * Build a minimal export payload from fetched data.
 * Caller is responsible for fetching full data (business + processes + messages).
 */
export function buildBusinessExportPayload(input: {
  business: { name: string; description?: string | null; industry?: string | null };
  processes: Array<{
    name: string;
    description: string;
    department: string;
    trigger?: string | null;
    inputs?: string | null;
    outputs?: string | null;
    manualSteps?: string | null;
    diagramMermaid?: string | null;
    messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>;
  }>;
  memories?: Array<{ fact: string; confidence?: number; source?: string | null }>;
}): BusinessExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    business: {
      name: input.business.name,
      description: input.business.description ?? null,
      industry: input.business.industry ?? null,
    },
    processes: input.processes.map((p) => ({
      name: p.name,
      description: p.description,
      department: p.department,
      trigger: p.trigger ?? null,
      inputs: p.inputs ?? null,
      outputs: p.outputs ?? null,
      manualSteps: p.manualSteps ?? null,
      diagramMermaid: p.diagramMermaid ?? null,
      messages: p.messages,
    })),
    memories: input.memories?.map((m) => ({ fact: m.fact, confidence: m.confidence, source: m.source })) ?? undefined,
  };
}

export async function createBusinessExportZip(payload: BusinessExportPayload, businessName: string): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("export.json", JSON.stringify(payload, null, 2));

  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "business";
  const zipBlob = await zip.generateAsync({ type: "blob" });
  return zipBlob;
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function makeExportFilename(businessName: string): string {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "business";
  return `${slug}-business-export.zip`;
}
