/** Discovery fields captured in the workshop Questions tab (3.3). */

export interface ProcessDiscoveryFields {
  trigger?: string | null;
  inputs?: string | null;
  manualSteps?: string | null;
  outputs?: string | null;
}

const DISCOVERY_LABELS: ReadonlyArray<{
  key: keyof ProcessDiscoveryFields;
  label: string;
}> = [
  { key: "trigger", label: "Who triggers this" },
  { key: "inputs", label: "Systems involved" },
  { key: "manualSteps", label: "Manual steps" },
  { key: "outputs", label: "Output / deliverable" },
];

export function hasDiscoveryAnswers(fields: ProcessDiscoveryFields): boolean {
  return DISCOVERY_LABELS.some(({ key }) => Boolean(fields[key]?.trim()));
}

/** Format discovery answers for Hermes agent prompts. Returns null when all fields are empty. */
export function formatDiscoveryContext(fields: ProcessDiscoveryFields): string | null {
  const lines = DISCOVERY_LABELS.flatMap(({ key, label }) => {
    const value = fields[key]?.trim();
    return value ? [`- ${label}: ${value}`] : [];
  });

  if (lines.length === 0) return null;

  return [
    "Discovery answers (from the Questions tab — treat as authoritative structured context):",
    ...lines,
  ].join("\n");
}

export function pickDiscoveryFields(
  process: ProcessDiscoveryFields,
): ProcessDiscoveryFields {
  return {
    trigger: process.trigger ?? null,
    inputs: process.inputs ?? null,
    manualSteps: process.manualSteps ?? null,
    outputs: process.outputs ?? null,
  };
}