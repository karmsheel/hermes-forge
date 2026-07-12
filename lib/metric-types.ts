export const METRIC_CHANNELS = [
  "linkedin",
  "x",
  "newsletter",
  "site",
  "other",
] as const;

export type MetricChannel = (typeof METRIC_CHANNELS)[number];

export const METRIC_COLLECTION_METHODS = [
  "manual",
  "hermes_job",
  "integration",
] as const;

export type MetricCollectionMethod = (typeof METRIC_COLLECTION_METHODS)[number];

export const METRIC_CHANNEL_LABELS: Record<MetricChannel, string> = {
  linkedin: "LinkedIn",
  x: "X / Twitter",
  newsletter: "Newsletter",
  site: "Website",
  other: "Other",
};

export const METRIC_METHOD_LABELS: Record<MetricCollectionMethod, string> = {
  manual: "Manual entry",
  hermes_job: "Hermes job",
  integration: "Integration",
};

export function isMetricChannel(value: string | null | undefined): value is MetricChannel {
  return Boolean(value && (METRIC_CHANNELS as readonly string[]).includes(value));
}

export function isMetricCollectionMethod(
  value: string | null | undefined,
): value is MetricCollectionMethod {
  return Boolean(value && (METRIC_COLLECTION_METHODS as readonly string[]).includes(value));
}
