/**
 * hermes.forge.context.v1 — page context protocol for the global chatbar (PR-3).
 */

import { pageBlurbForPath, type PageBlurb } from "./page-registry";
import {
  CHATBAR_CONTEXT_MODES,
  type ChatbarContextMode,
  normalizeChatbarContextMode,
} from "./context-scope";
import { redactRecord, redactSecrets } from "./redaction";

export const FORGE_CONTEXT_PROTOCOL = "hermes.forge.context.v1" as const;

export const SNAPSHOT_MAX_CHARS = 3500;

export type ForgePinnedEntity = {
  type: "process" | "automation" | "person" | "function" | "event";
  id: string;
  label: string;
};

export type ForgeContextSelection = {
  type: string;
  summary: string;
  details?: Record<string, unknown>;
};

export type ForgeContextSnapshot = {
  text: string;
  approxChars: number;
};

export type ForgeContextPayload = {
  protocol: typeof FORGE_CONTEXT_PROTOCOL;
  contextScope: {
    mode: ChatbarContextMode;
    route: string;
    routeKey: string;
    pinned?: ForgePinnedEntity;
  };
  business: {
    id: string;
    name: string;
  };
  page: {
    title: string;
    purpose: string;
    firstVisit: boolean;
    uiHints?: string[];
  };
  selection?: ForgeContextSelection;
  snapshot?: ForgeContextSnapshot;
};

/** Client-registered live page data (not the full protocol payload). */
export type PageContextRegistration = {
  selection?: ForgeContextSelection;
  /** Extra snapshot lines from the page (merged with shell snapshot). */
  snapshotLines?: string[];
  pinned?: ForgePinnedEntity;
};

export type ContextReceipt = {
  protocol: typeof FORGE_CONTEXT_PROTOCOL;
  mode: ChatbarContextMode;
  route: string;
  routeKey: string;
  pageTitle: string;
  businessName: string;
  pinnedLabel?: string;
  selectionSummary?: string;
  snapshotChars: number;
  attachmentCount: number;
  redactionCount: number;
  firstVisit: boolean;
};

export function clampSnapshotText(
  text: string,
  maxChars = SNAPSHOT_MAX_CHARS,
): { text: string; approxChars: number; truncated: boolean } {
  const raw = String(text || "").trim();
  if (raw.length <= maxChars) {
    return { text: raw, approxChars: raw.length, truncated: false };
  }
  const cut = raw.slice(0, Math.max(0, maxChars - 1)).trimEnd();
  const textOut = `${cut}…`;
  return { text: textOut, approxChars: textOut.length, truncated: true };
}

export type BuildForgeContextOptions = {
  mode: ChatbarContextMode;
  route: string;
  business: { id: string; name: string };
  firstVisit?: boolean;
  page?: PageBlurb;
  registration?: PageContextRegistration | null;
  /** Shell-level snapshot text (from API or builder). */
  shellSnapshotText?: string;
  attachmentCount?: number;
};

export type BuildForgeContextResult = {
  payload: ForgeContextPayload;
  receipt: ContextReceipt;
  redactionCount: number;
};

/**
 * Build a protocol payload + receipt. Applies redaction and chat-only stripping.
 */
export function buildForgeContext(
  options: BuildForgeContextOptions,
): BuildForgeContextResult {
  const mode = normalizeChatbarContextMode(options.mode);
  const route = options.route || "/home";
  const page = options.page ?? pageBlurbForPath(route);
  const firstVisit = Boolean(options.firstVisit);
  let redactionCount = 0;

  const lines: string[] = [];
  if (options.shellSnapshotText?.trim()) {
    lines.push(options.shellSnapshotText.trim());
  }
  for (const line of options.registration?.snapshotLines || []) {
    if (line?.trim()) lines.push(line.trim());
  }

  let snapshot: ForgeContextSnapshot | undefined;
  let selection: ForgeContextSelection | undefined;
  let pinned = options.registration?.pinned;

  if (mode === CHATBAR_CONTEXT_MODES.CHAT_ONLY) {
    // Business name only — no snapshot/selection/pin
    pinned = undefined;
  } else {
    if (lines.length > 0) {
      const joined = lines.join("\n");
      const redacted = redactSecrets(joined);
      redactionCount += redacted.redactionCount;
      const clamped = clampSnapshotText(redacted.text);
      if (clamped.text) {
        snapshot = { text: clamped.text, approxChars: clamped.approxChars };
      }
    }

    const regSel = options.registration?.selection;
    if (regSel?.summary) {
      const sum = redactSecrets(regSel.summary);
      redactionCount += sum.redactionCount;
      const det = redactRecord(regSel.details);
      redactionCount += det.redactionCount;
      selection = {
        type: regSel.type || "selection",
        summary: sum.text,
        ...(det.details ? { details: det.details } : {}),
      };
    }

    if (pinned) {
      const lab = redactSecrets(pinned.label);
      redactionCount += lab.redactionCount;
      pinned = { ...pinned, label: lab.text };
    }
  }

  // Pinned-entity mode without pin falls back to follow-page semantics in payload mode field as-is
  const payload: ForgeContextPayload = {
    protocol: FORGE_CONTEXT_PROTOCOL,
    contextScope: {
      mode,
      route,
      routeKey: page.routeKey,
      ...(pinned && mode !== CHATBAR_CONTEXT_MODES.CHAT_ONLY ? { pinned } : {}),
    },
    business: {
      id: options.business.id,
      name: options.business.name,
    },
    page: {
      title: page.title,
      purpose: page.purpose,
      firstVisit,
      ...(page.uiHints?.length ? { uiHints: page.uiHints } : {}),
    },
    ...(selection ? { selection } : {}),
    ...(snapshot ? { snapshot } : {}),
  };

  const receipt: ContextReceipt = {
    protocol: FORGE_CONTEXT_PROTOCOL,
    mode,
    route,
    routeKey: page.routeKey,
    pageTitle: page.title,
    businessName: options.business.name,
    ...(pinned ? { pinnedLabel: `${pinned.type}: ${pinned.label}` } : {}),
    ...(selection ? { selectionSummary: selection.summary } : {}),
    snapshotChars: snapshot?.approxChars ?? 0,
    attachmentCount: options.attachmentCount ?? 0,
    redactionCount,
    firstVisit,
  };

  return { payload, receipt, redactionCount };
}

/** Human-readable untrusted context block for the model. */
export function serializeForgeContextForPrompt(payload: ForgeContextPayload): string {
  const lines: string[] = [
    "UNTRUSTED_FORGE_CONTEXT_START",
    `protocol: ${payload.protocol}`,
    `scope.mode: ${payload.contextScope.mode}`,
    `route: ${payload.contextScope.route}`,
    `routeKey: ${payload.contextScope.routeKey}`,
    `business: ${payload.business.name} (${payload.business.id})`,
    `page.title: ${payload.page.title}`,
    `page.purpose: ${payload.page.purpose}`,
    `page.firstVisit: ${payload.page.firstVisit ? "yes" : "no"}`,
  ];

  if (payload.page.uiHints?.length) {
    lines.push(`page.uiHints: ${payload.page.uiHints.join(" | ")}`);
  }
  if (payload.contextScope.pinned) {
    const p = payload.contextScope.pinned;
    lines.push(`pinned: ${p.type} ${p.label} (${p.id})`);
  }
  if (payload.selection) {
    lines.push(`selection.type: ${payload.selection.type}`);
    lines.push(`selection.summary: ${payload.selection.summary}`);
    if (payload.selection.details && Object.keys(payload.selection.details).length) {
      try {
        lines.push(`selection.details: ${JSON.stringify(payload.selection.details)}`);
      } catch {
        // skip
      }
    }
  }
  if (payload.snapshot?.text) {
    lines.push("snapshot:");
    lines.push(payload.snapshot.text);
    lines.push(`(snapshot ~${payload.snapshot.approxChars} chars)`);
  } else if (payload.contextScope.mode === CHATBAR_CONTEXT_MODES.CHAT_ONLY) {
    lines.push("snapshot: (chat-only — no page snapshot)");
  } else {
    lines.push("snapshot: (none registered)");
  }

  lines.push("UNTRUSTED_FORGE_CONTEXT_END");
  return lines.join("\n");
}

/** Local first-visit intro copy (no API call). Snapshot is separate for collapsible UI. */
export type PageIntroCopy = {
  /** Short welcome markdown always shown in the intro banner. */
  body: string;
  /**
   * Live page snapshot Hermes receives with Follow page.
   * UI should show this collapsed by default under “What Hermes can see”.
   */
  agentView?: string;
};

/** Build a short local intro message (no API call). */
export function buildPageIntroCopy(options: {
  businessName: string;
  page: PageBlurb;
  snapshotText?: string;
}): PageIntroCopy {
  const hints =
    options.page.uiHints?.length ?
      options.page.uiHints.map((h) => `- ${h}`).join("\n")
    : "- Ask me what you can do here\n- Ask me to explain what you are looking at";

  const agentView = options.snapshotText?.trim() || undefined;

  const body = [
    `This is **${options.page.title}** for **${options.businessName}**.`,
    options.page.purpose,
    "",
    "Things you can try:",
    hints,
    "",
    "Ask me anything about this page — or switch the scope chip to **Chat only** if you want a general conversation without page data.",
  ].join("\n");

  return {
    body,
    ...(agentView ? { agentView } : {}),
  };
}
