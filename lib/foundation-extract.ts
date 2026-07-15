/**
 * Extract Foundation draft process stubs from chat text (Phase 6.3).
 * Prefers explicit ```forge-drafts``` fences; can fall back to Hermes extraction.
 */

import { callHermes, parseJsonFromLlm, type HermesConfig } from "@/lib/hermes";
import {
  normalizeSeedDrafts,
  type SeedDraftInput,
} from "@/lib/foundation";
import { isIoShapeId, normalizeIoShape } from "@/lib/io-shape";

export const FORGE_DRAFTS_FENCE = "forge-drafts";

export type ProposedDraft = SeedDraftInput & {
  name: string;
  /** Existing process id when name matches (case-insensitive) */
  existingProcessId?: string | null;
  isDuplicate?: boolean;
};

export type ExtractDraftsResult = {
  drafts: ProposedDraft[];
  source: "fence" | "hermes" | "empty";
  rawFenceFound: boolean;
};

const FENCE_RE =
  /```(?:forge-drafts|json)\s*\n([\s\S]*?)```/gi;

/**
 * Parse ```forge-drafts ... ``` or ```json ... ``` blocks that contain a drafts array
 * or a bare array of draft objects.
 */
export function parseForgeDraftsFence(text: string | null | undefined): SeedDraftInput[] {
  if (!text?.trim()) return [];

  const collected: SeedDraftInput[] = [];
  const re = new RegExp(FENCE_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const items = coerceDraftArray(parsed);
      collected.push(...items);
    } catch {
      try {
        const parsed = parseJsonFromLlm(body);
        collected.push(...coerceDraftArray(parsed));
      } catch {
        /* skip unparseable fence */
      }
    }
  }

  return normalizeSeedDrafts(collected);
}

function coerceDraftArray(raw: unknown): SeedDraftInput[] {
  if (Array.isArray(raw)) {
    return raw.map(itemToDraft).filter((d): d is SeedDraftInput => Boolean(d?.name));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.drafts)) {
      return obj.drafts
        .map(itemToDraft)
        .filter((d): d is SeedDraftInput => Boolean(d?.name));
    }
    // Single object shaped like a draft
    const one = itemToDraft(raw);
    return one?.name ? [one] : [];
  }
  return [];
}

function itemToDraft(item: unknown): SeedDraftInput | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  return {
    name,
    description:
      typeof row.description === "string" ? row.description : null,
    department:
      typeof row.department === "string"
        ? row.department
        : typeof row.function === "string"
          ? row.function
          : null,
    ioShape:
      typeof row.ioShape === "string"
        ? normalizeIoShape(row.ioShape)
        : typeof row.shape === "string"
          ? normalizeIoShape(row.shape)
          : null,
    trigger: typeof row.trigger === "string" ? row.trigger : null,
    inputs: typeof row.inputs === "string" ? row.inputs : null,
    outputs: typeof row.outputs === "string" ? row.outputs : null,
  };
}

/** Annotate proposed drafts with existing process matches. */
export function annotateDuplicates(
  drafts: SeedDraftInput[],
  existing: Array<{ id: string; name: string }>
): ProposedDraft[] {
  const byName = new Map(
    existing.map((p) => [p.name.trim().toLowerCase(), p.id])
  );
  return normalizeSeedDrafts(drafts).map((d) => {
    const id = byName.get(d.name.toLowerCase()) ?? null;
    return {
      ...d,
      existingProcessId: id,
      isDuplicate: Boolean(id),
    };
  });
}

export function extractDraftsFromText(
  text: string | null | undefined,
  existing: Array<{ id: string; name: string }> = []
): ExtractDraftsResult {
  const fromFence = parseForgeDraftsFence(text);
  if (fromFence.length > 0) {
    return {
      drafts: annotateDuplicates(fromFence, existing),
      source: "fence",
      rawFenceFound: true,
    };
  }
  return {
    drafts: [],
    source: "empty",
    rawFenceFound: /```(?:forge-drafts|json)/i.test(text || ""),
  };
}

const EXTRACT_SYSTEM = `You extract draft business process stubs for Hermes Forge Foundation room.

Return ONLY valid JSON:
{
  "drafts": [
    {
      "name": "Short process name",
      "description": "One sentence",
      "department": "Sales|Marketing|Operations|Finance|Support|HR|Custom or free text",
      "ioShape": "siso|simo|miso|mimo",
      "trigger": "optional",
      "inputs": "optional free text, use + or newlines for multiple",
      "outputs": "optional free text"
    }
  ]
}

Rules:
- Only invent processes the user actually described or clearly implied.
- Prefer 1–8 drafts. No Mermaid. No prose outside JSON.
- ioShape is the black-box interface (not internal branches). Default siso when unsure.
- If nothing process-like was discussed, return {"drafts":[]}.`;

/**
 * Use Hermes to extract drafts from conversation transcript when no fence is present.
 */
export async function extractDraftsWithHermes(
  config: HermesConfig,
  transcript: string,
  existing: Array<{ id: string; name: string }> = []
): Promise<ExtractDraftsResult> {
  const fenced = extractDraftsFromText(transcript, existing);
  if (fenced.drafts.length > 0) return fenced;

  const trimmed = transcript.trim();
  if (!trimmed) {
    return { drafts: [], source: "empty", rawFenceFound: false };
  }

  const content = await callHermes(
    config,
    [
      { role: "system", content: EXTRACT_SYSTEM },
      {
        role: "user",
        content: `Existing process names (do not re-create unless refining meaning):\n${
          existing.map((p) => `- ${p.name}`).join("\n") || "(none)"
        }\n\nConversation / notes:\n${trimmed.slice(0, 12000)}`,
      },
    ],
    { temperature: 0.2 }
  );

  let raw: unknown;
  try {
    raw = parseJsonFromLlm(content);
  } catch {
    // Try fence parse on model output
    const again = parseForgeDraftsFence(content);
    return {
      drafts: annotateDuplicates(again, existing),
      source: again.length ? "hermes" : "empty",
      rawFenceFound: false,
    };
  }

  const items = coerceDraftArray(raw).map((d) => ({
    ...d,
    ioShape: d.ioShape && isIoShapeId(d.ioShape) ? d.ioShape : normalizeIoShape(d.ioShape),
  }));

  return {
    drafts: annotateDuplicates(items, existing),
    source: items.length ? "hermes" : "empty",
    rawFenceFound: false,
  };
}

/** Build transcript string from chat messages (newest last). */
export function messagesToTranscript(
  messages: Array<{ role: string; content: string }>,
  maxMessages = 40
): string {
  const slice = messages.slice(-maxMessages);
  return slice
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

/**
 * Prompt addon: instruct Hermes to emit forge-drafts fences when proposing stubs.
 */
export function foundationDraftsFencePromptAddon(): string {
  return [
    "When you propose one or more new process drafts the user should seed on the Foundation canvas, end your reply with a fenced JSON block using language tag forge-drafts:",
    "```forge-drafts",
    '[{"name":"Example","description":"...","department":"Operations","ioShape":"siso","inputs":"...","outputs":"..."}]',
    "```",
    "Only include processes the user described. The app will offer to seed these stubs (no Mermaid). Omit the fence if you are only answering a question without proposing new drafts.",
  ].join("\n");
}

/** Browser event name for chatbar → Foundation proposed drafts handoff. */
export const FOUNDATION_DRAFTS_EVENT = "forge:foundation-drafts";

export const LAST_STUDIO_CONVERSATION_KEY = "forge:last-studio-conversation";

export type FoundationDraftsEventDetail = {
  drafts: SeedDraftInput[];
  conversationId?: string | null;
  assistantMessageId?: string | null;
};

export function rememberStudioConversationId(id: string | null | undefined): void {
  if (typeof window === "undefined" || !id) return;
  try {
    sessionStorage.setItem(LAST_STUDIO_CONVERSATION_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readRememberedStudioConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LAST_STUDIO_CONVERSATION_KEY);
  } catch {
    return null;
  }
}

export function dispatchFoundationDrafts(detail: FoundationDraftsEventDetail): void {
  if (typeof window === "undefined") return;
  if (detail.conversationId) {
    rememberStudioConversationId(detail.conversationId);
  }
  window.dispatchEvent(
    new CustomEvent(FOUNDATION_DRAFTS_EVENT, { detail })
  );
}
