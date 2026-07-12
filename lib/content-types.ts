export const CONTENT_STATUSES = [
  "idea",
  "draft",
  "review",
  "ready",
  "shipped",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_CHANNELS = [
  "linkedin",
  "x",
  "newsletter",
  "blog",
  "other",
] as const;

export type ContentChannel = (typeof CONTENT_CHANNELS)[number];

export const CONTENT_SOURCES = ["manual", "hermes", "import"] as const;

export type ContentSource = (typeof CONTENT_SOURCES)[number];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  review: "Review",
  ready: "Ready",
  shipped: "Shipped",
};

export const CONTENT_CHANNEL_LABELS: Record<ContentChannel, string> = {
  linkedin: "LinkedIn",
  x: "X / Twitter",
  newsletter: "Newsletter",
  blog: "Blog",
  other: "Other",
};

export function isContentStatus(value: string | null | undefined): value is ContentStatus {
  return Boolean(value && (CONTENT_STATUSES as readonly string[]).includes(value));
}

export function isContentChannel(value: string | null | undefined): value is ContentChannel {
  return Boolean(value && (CONTENT_CHANNELS as readonly string[]).includes(value));
}

export type ContentHealthCounts = Record<ContentStatus, number> & { total: number };

export function emptyContentHealth(): ContentHealthCounts {
  return {
    idea: 0,
    draft: 0,
    review: 0,
    ready: 0,
    shipped: 0,
    total: 0,
  };
}
