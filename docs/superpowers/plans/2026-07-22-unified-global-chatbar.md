# Unified Global Chatbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One global chatbar surface for all shell pages; pages inject context/tools/prompt packs; Settings shows every system prompt; Hermes API usage/stream/session-key upgrades from `HERMES_API_SERVER.md`.

**Architecture:** Central prompt catalog + page module registration feed a single `ChatbarPanel` tree. Conversation `kind` (studio/process/automation) selects server prompt pack and side effects. Hermes client always streams interactive turns, parses usage, and sets memory session headers. Settings is a read-through viewer of the same builders.

**Tech Stack:** Next.js App Router, React client chatbar, Prisma `Conversation`/`ChatMessage`, Hermes OpenAI-compatible API (`streamHermesEvents`), SSE from Forge API routes.

**Design:** `docs/superpowers/specs/2026-07-22-unified-global-chatbar-design.md`  
**Research:** `docs/references/HERMES_API_SERVER.md`  
**Prior art:** `docs/references/GLOBAL_CHATBAR.md`

## Global Constraints

- Do **not** duplicate prompt strings — catalog builders are the only source of system text for interactive chat.
- Never put API keys or Hermes secrets into Settings previews or page snapshots (use existing redaction).
- Workshop Overlord-only agent policy stays enforced client + server.
- Prefer small, mergeable PRs in phase order; feature-flag Workshop UI cutover.
- Desktop/web both use the same chat routes (server-to-server Hermes).
- Update `GLOBAL_CHATBAR.md` + `HERMES_API_SERVER.md` usage column when a phase lands.
- Tests: `npx tsx --test tests/unit/<file>.test.ts`; TypeScript: `npx tsc --noEmit`.

---

## File map (target)

| Path | Responsibility |
|------|----------------|
| `lib/chatbar/prompt-catalog.ts` | Registry of prompt packs + metadata + build entrypoints |
| `lib/chatbar/page-module.ts` | Client `PageChatModule` types |
| `lib/chatbar/session-headers.ts` | `X-Hermes-Session-Key` / `X-Hermes-Session-Id` builders |
| `lib/chatbar/usage.ts` | Normalize Hermes usage objects |
| `lib/hermes.ts` / `lib/hermes-stream.ts` | Return usage; attach session headers |
| `lib/chatbar/context-meter.ts` | Dual-mode estimate + last-turn usage |
| `components/chatbar/ChatbarComposer.tsx` | Unified composer (studio chrome + mentions/slash) |
| `components/chatbar/ChatbarPanel.tsx` | Single tree; no process early-return (end state) |
| `components/chatbar/ChatbarProvider.tsx` | `registerPageModule` (supersedes process session) |
| `components/chatbar/page-providers/*` | Register modules (Workshop pin, etc.) |
| `app/api/studio/conversations/[id]/chat/route.ts` | Unified send; process kind side effects |
| `app/api/settings/prompt-catalog/route.ts` | Catalog metadata |
| `app/api/settings/prompt-preview/route.ts` | Live build for Settings |
| `components/settings/SettingsAgentPrompts.tsx` | Settings UI |
| `lib/settings-views.ts` | New `agent-prompts` view |
| `tests/unit/prompt-catalog.test.ts` | Catalog + builder equality |
| `tests/unit/hermes-usage.test.ts` | Usage normalize |
| `tests/unit/session-headers.test.ts` | Header format |

---

### Task 0: Prompt catalog + Settings Agent prompts (no chat behavior change)

**Files:**
- Create: `lib/chatbar/prompt-catalog.ts`
- Create: `app/api/settings/prompt-catalog/route.ts`
- Create: `app/api/settings/prompt-preview/route.ts`
- Create: `components/settings/SettingsAgentPrompts.tsx`
- Create: `tests/unit/prompt-catalog.test.ts`
- Modify: `lib/settings-views.ts`
- Modify: `components/settings/SettingsContent.tsx`
- Modify: `lib/chatbar/studio-prompt.ts` (re-export via catalog wrappers if needed)
- Modify: `lib/diagram.ts` (export builders used by catalog; no string move required if catalog imports existing fns)
- Modify: `docs/references/GLOBAL_CHATBAR.md` (link design + note Settings)

**Interfaces:**
- Produces:
  - `listPromptCatalog(): PromptCatalogMeta[]`
  - `buildPromptPack(id, ctx): { system: string; pageContext: string | null }`
  - `GET /api/settings/prompt-catalog` → `{ packs: PromptCatalogMeta[] }`
  - `GET /api/settings/prompt-preview?pack=&route=` → `{ system, pageContext, packId, route }`
- Consumes: existing `buildStudioChatSystemPrompt`, `buildChatSystemPrompt`, `foundationStudioPromptAddon`, automation prompts

- [ ] **Step 1: Write failing unit tests for catalog membership**

```ts
// tests/unit/prompt-catalog.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listPromptCatalog,
  buildPromptPack,
  PROMPT_PACK_IDS,
} from "@/lib/chatbar/prompt-catalog";

describe("prompt catalog", () => {
  it("includes chatbar packs for studio, foundation, workshop, automation", () => {
    const ids = listPromptCatalog().map((p) => p.id);
    for (const id of [
      "studio-default",
      "foundation",
      "workshop-process",
      "automation-architect",
    ]) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
  });

  it("lists background packs separately", () => {
    const bg = listPromptCatalog().filter((p) => p.surface === "background");
    assert.ok(bg.some((p) => p.id === "diagram-subagent"));
  });

  it("buildPromptPack studio-default mentions Forge and business name", () => {
    const { system } = buildPromptPack("studio-default", {
      businessName: "Acme",
      route: "/home",
      mode: "follow-page",
      agent: null,
    });
    assert.match(system, /Acme/);
    assert.match(system, /Hermes Forge/i);
  });

  it("buildPromptPack workshop-process uses process analyst framing", () => {
    const { system } = buildPromptPack("workshop-process", {
      businessName: "Acme",
      route: "/workshop",
      processName: "Order flow",
      mode: "follow-page",
    });
    assert.match(system, /Business Process Analyst|process/i);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```powershell
npx tsx --test tests/unit/prompt-catalog.test.ts
```

- [ ] **Step 3: Implement `lib/chatbar/prompt-catalog.ts`**

Wrap existing builders; do not copy prompt bodies:

```ts
import { buildStudioChatSystemPrompt, buildStudioPageContextMessage } from "./studio-prompt";
import { buildChatSystemPrompt } from "@/lib/diagram";
// ... automation-chat, foundation addons via studio path, DIAGRAM_SYSTEM export if needed

export const PROMPT_PACK_IDS = [
  "studio-default",
  "foundation",
  "map-plant",
  "workshop-process",
  "automation-architect",
  "diagram-subagent",
  "automation-extract",
  "automation-deploy",
] as const;

export type PromptPackId = (typeof PROMPT_PACK_IDS)[number];

export type PromptCatalogMeta = {
  id: PromptPackId;
  title: string;
  surface: "chatbar" | "background" | "job";
  routes: string[];
  description: string;
};

export type PromptBuildContext = {
  businessName: string;
  route: string;
  mode?: "follow-page" | "chat-only" | "pinned-entity";
  agent?: { displayName: string; description?: string | null; model?: string | null; profileKey?: string | null } | null;
  processName?: string;
  // optional fields process/diagram builders need — pass through as optional bags
  processContext?: Parameters<typeof buildChatSystemPrompt>[0];
  pageContextPayload?: import("./context-protocol").ForgeContextPayload;
};

export function listPromptCatalog(): PromptCatalogMeta[] { /* static meta */ }

export function buildPromptPack(
  id: PromptPackId,
  ctx: PromptBuildContext,
): { system: string; pageContext: string | null } {
  switch (id) {
    case "studio-default":
    case "foundation":
    case "map-plant":
      return {
        system: buildStudioChatSystemPrompt({
          businessName: ctx.businessName,
          route: ctx.route,
          mode: ctx.mode,
          agent: ctx.agent,
        }),
        pageContext: ctx.pageContextPayload
          ? buildStudioPageContextMessage({ payload: ctx.pageContextPayload })
          : null,
      };
    case "workshop-process":
      return {
        system: ctx.processContext
          ? buildChatSystemPrompt(ctx.processContext)
          : buildChatSystemPrompt({
              processName: ctx.processName || "Process",
              // minimal defaults for Settings preview
            } as Parameters<typeof buildChatSystemPrompt>[0]),
        pageContext: null,
      };
    // ... remaining packs
    default:
      throw new Error(`Unknown pack ${id}`);
  }
}
```

Adjust `buildChatSystemPrompt` call args to match its real signature in `lib/diagram.ts` (read file; pass required fields with empty/defaults for preview).

- [ ] **Step 4: API routes (auth required)**

```ts
// app/api/settings/prompt-catalog/route.ts
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth"; // use project’s actual session helper
import { listPromptCatalog } from "@/lib/chatbar/prompt-catalog";

export async function GET(request: Request) {
  const session = await requireSession(request); // adapt to codebase
  if ("error" in session) return session.error;
  return NextResponse.json({ packs: listPromptCatalog() });
}
```

Preview route: resolve active business name from shell/session; call `buildPromptPack`; redact.

- [ ] **Step 5: Settings UI**

- Add `SettingsViewId` value `"agent-prompts"` with label **Agent prompts** (icon: `MessageSquare` or `ScrollText`).
- `SettingsAgentPrompts`: fetch catalog; accordion per pack; buttons Copy / Live preview.
- Wire `SettingsContent` switch case.

- [ ] **Step 6: Run unit tests + typecheck**

```powershell
npx tsx --test tests/unit/prompt-catalog.test.ts
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```powershell
git add lib/chatbar/prompt-catalog.ts app/api/settings/prompt-catalog/route.ts app/api/settings/prompt-preview/route.ts components/settings/SettingsAgentPrompts.tsx lib/settings-views.ts components/settings/SettingsContent.tsx tests/unit/prompt-catalog.test.ts docs/references/GLOBAL_CHATBAR.md
git commit -m "feat: Settings Agent prompts viewer and prompt catalog"
```

---

### Task 1: Hermes usage plumbing + dual-mode meter (HERMES Tier A)

**Files:**
- Create: `lib/chatbar/usage.ts`
- Create: `tests/unit/hermes-usage.test.ts`
- Modify: `lib/hermes.ts` — return `{ content, usage }` (or new helper; update call sites carefully)
- Modify: `lib/hermes-stream.ts` — capture usage from final chunk / optional run poll
- Modify: `app/api/studio/conversations/[id]/chat/route.ts` — SSE `event: usage`
- Modify: `lib/chatbar/context-meter.ts` + `ChatbarDesktopBar` / panel meter inputs
- Modify: `docs/references/HERMES_API_SERVER.md` (Forge column: usage partial → wired)

**Interfaces:**
- Produces: `normalizeHermesUsage(raw): { promptTokens, completionTokens, totalTokens } | null`
- Produces: meter modes `estimate` | `lastTurn`

- [ ] **Step 1: Unit tests for normalize**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeHermesUsage } from "@/lib/chatbar/usage";

describe("normalizeHermesUsage", () => {
  it("reads chat.completions usage", () => {
    const u = normalizeHermesUsage({
      prompt_tokens: 50,
      completion_tokens: 200,
      total_tokens: 250,
    });
    assert.equal(u?.promptTokens, 50);
    assert.equal(u?.totalTokens, 250);
  });

  it("reads responses/runs usage", () => {
    const u = normalizeHermesUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    });
    assert.equal(u?.promptTokens, 10);
    assert.equal(u?.completionTokens, 20);
  });

  it("returns null for empty", () => {
    assert.equal(normalizeHermesUsage(null), null);
  });
});
```

- [ ] **Step 2: Implement normalize + wire stream/non-stream**

Minimal non-stream change pattern in `callHermes`:

```ts
// Prefer additive API to avoid mass breakage:
export async function callHermesWithMeta(...): Promise<{ content: string; usage: NormalizedUsage | null }>
// Keep callHermes() returning string by delegating.
```

Studio stream: on end, if `run_id` known and no usage in stream, optional `GET ${base}/v1/runs/${runId}` with auth; emit SSE:

```ts
controller.enqueue(encodeSse({ type: "usage", usage: normalized }));
```

- [ ] **Step 3: Client meter**

- Store `lastTurnUsage` on conversation state in `ChatbarPanel`.
- Display: while typing → estimate (include system overhead constant + page snapshot + draft + history); after turn → “Last turn · N tokens (Hermes)”.
- Label must say estimate vs Hermes-reported.

- [ ] **Step 4: Tests + commit**

```powershell
npx tsx --test tests/unit/hermes-usage.test.ts
git commit -m "feat: parse Hermes usage and dual-mode context meter"
```

---

### Task 2: Session headers (HERMES Tier C partial)

**Files:**
- Create: `lib/chatbar/session-headers.ts`
- Create: `tests/unit/session-headers.test.ts`
- Modify: `lib/hermes-stream.ts`, `lib/hermes.ts` — accept `sessionKey`, `sessionId` options; set headers

**Interfaces:**
- Produces: `buildHermesSessionKey({ userId, businessId, agentProfileKey }): string`  
  Format: `forge:{userId}:{businessId}:{agentProfileKey || "default"}`
- Produces: `buildHermesSessionId(conversationId): string` → `forge-conv:{conversationId}`

- [ ] **Step 1: Tests for format**

```ts
assert.equal(
  buildHermesSessionKey({ userId: "u1", businessId: "b1", agentProfileKey: "overlord" }),
  "forge:u1:b1:overlord",
);
```

- [ ] **Step 2: Pass headers from studio chat route** on every Hermes call.

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: set X-Hermes-Session-Key and Session-Id on chat requests"
```

---

### Task 3: Unified chatbar composer component

**Files:**
- Create: `components/chatbar/ChatbarComposer.tsx`
- Modify: `components/chatbar/ChatbarPanel.tsx` (studio footer uses it)
- Modify: `components/workshop/rich-composer/*` (extract shared mention/slash into composer or import)
- Test: manual + any existing composer-state unit tests still pass

**Interfaces:**
- Produces:

```ts
type ChatbarComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  mentionables?: Mentionable[];
  commands?: SlashCommandSpec[];
  selectedNode?: { label: string } | null;
  onClearNode?: () => void;
  composerState: ReturnType<typeof composerControlState>;
  onStop?: () => void;
  onSteer?: () => void;
  onQueue?: () => void;
  willQueue?: boolean;
};
```

- [ ] **Step 1: Extract ChatbarComposer from current studio footer layout** (model select + actions unchanged).

- [ ] **Step 2: Port mention/slash from RichComposer into ChatbarComposer** when props provided (feature parity behind props, default off for non-workshop).

- [ ] **Step 3: Studio path uses ChatbarComposer; process path still ProcessChat until Task 5** (or ProcessChat embeds ChatbarComposer with studioChrome).

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat: unified ChatbarComposer with optional mentions and slash"
```

---

### Task 4: Server — process turns via studio chat (stream parity)

**Files:**
- Modify: `app/api/studio/conversations/[id]/chat/route.ts`
- Possibly: `lib/chatbar/prompt-catalog.ts` (workshop pack with full process context)
- Port side effects from `app/api/processes/[id]/chat/route.ts` (accuracy forge, split, diagram trigger, nodeContext, documents, personnel)
- Keep process route as thin proxy calling shared `runProcessChatTurn(...)` helper

**Interfaces:**
- Produces: `lib/chatbar/run-chat-turn.ts` (or `lib/process-chat-turn.ts`)  
  `runInteractiveChatTurn(args): AsyncGenerator<SseEvent>`

- [ ] **Step 1: Extract shared turn runner from process chat route** without changing behavior; process route calls it.

- [ ] **Step 2: Switch process runner from `callHermes` to `streamHermesEvents`**; forward tool + delta + usage events.

- [ ] **Step 3: Studio chat route: if `conversation.kind === "process"` and `processId`, call same runner.**

- [ ] **Step 4: Integration smoke — manual process chat streams; stop button works.**

- [ ] **Step 5: Commit**

```powershell
git commit -m "feat: stream process chat turns via shared runner and studio route"
```

---

### Task 5: Workshop cutover — single panel tree

**Files:**
- Modify: `components/chatbar/ChatbarProvider.tsx` — `registerPageModule`; deprecate `registerProcessSession`
- Modify: `components/workshop/WorkshopSession.tsx` — pin process + mentionables + commands; stop owning chat HTTP
- Modify: `components/chatbar/ChatbarPanel.tsx` — **remove** `if (isProcessScoped && processSession)` full alternate tree; filter sessions by pin
- Modify: `components/chatbar/page-providers/WorkshopPageContext.tsx`
- Feature flag: `localStorage` or developer setting `unifiedWorkshopChat` default **true** after soak

**Interfaces:**
- Workshop registers:

```ts
registerPageModule({
  routeKey: "workshop",
  promptPack: "workshop-process",
  pin: activeProcess ? { type: "process", id, label: name } : undefined,
  mentionables,
  commands: workshopSlashCommands,
  composerChrome: selectedNode ? { kind: "node-target", label, onClear } : null,
  context: { /* existing snapshot registration */ },
  onMessagesSynced: (msgs) => updateCommentDots(msgs),
});
```

- Chatbar loads process conversations when pin set; `createConversation` uses `kind: "process", processId`.
- Send uses studio chat endpoint only.

- [ ] **Step 1: Implement page module type + provider registration.**

- [ ] **Step 2: ChatbarPanel: when pin.type === process, load process conversations into session menu (reuse ConversationsMenu data shape).**

- [ ] **Step 3: Migrate send/history off WorkshopSession chat handlers into ChatbarPanel** (Workshop keeps diagram agent triggers if still client-driven — prefer server-side as today).

- [ ] **Step 4: Remove process early-return UI; delete dead CSS only after visual QA.**

- [ ] **Step 5: Enforce Overlord-only on `/workshop` (already path-based); ensure process conversation creation does not switch agent.**

- [ ] **Step 6: Manual QA checklist**

  - New process chat, @ mention, /export, node click target, fork, forge accuracy flow, unforge, multi-tab workshop.
  - Navigate to Foundation mid-thread — studio sessions restore; process pin clears.

- [ ] **Step 7: Commit**

```powershell
git commit -m "feat: Workshop uses unified chatbar with process pin and page module"
```

---

### Task 6: Automation design surface into unified chatbar

**Files:**
- Modify: automation page registration + `ChatbarPanel` automation early-return removal
- Prompt pack `automation-architect`
- Stream path for automation chat

- [ ] **Step 1: Same pattern as Task 5 with pin type automation.**

- [ ] **Step 2: Commit**

```powershell
git commit -m "feat: automation design chat on unified global chatbar"
```

---

### Task 7: Approvals UI + model picker honesty (HERMES Tier D partial)

**Files:**
- Modify: `lib/chatbar/runtime-events.ts` consumers in `ChatbarPanel`
- Create: approval modal component
- Modify: `ChatbarDesktopBar` / model select title copy
- API: proxy `POST /api/hermes/runs/[id]/approval` or call Hermes from existing connection helper

- [ ] **Step 1: On `approval.requested`, show modal Approve/Deny → `POST /v1/runs/{id}/approval`.**

- [ ] **Step 2: Model control label: “Hermes model id” / tooltip that server profile may decide real LLM.**

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: chatbar tool approval UI and honest model picker copy"
```

---

### Task 8: Responses/Sessions pilot (HERMES Tier C optional)

**Files:**
- `lib/hermes-responses.ts` (new)
- Feature flag; studio-default pack only
- Store `previousResponseId` on conversation metadata JSON or column

- [ ] **Step 1: Behind flag, use `POST /v1/responses` with `previous_response_id` for studio turns; measure token reduction via usage.**

- [ ] **Step 2: Document results in `HERMES_API_SERVER.md`.**

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: optional Hermes Responses API pilot for studio chat"
```

---

### Task 9: Cleanup + docs + backlog

**Files:**
- Delete or slim: `lib/chatbar/process-session.ts`, unused ProcessChat embed path
- Modify: `docs/references/GLOBAL_CHATBAR.md`, `HERMES_API_SERVER.md`, `PRODUCT_BACKLOG.md` (4.19), `audit.md`, `INDEX.md` if needed

- [ ] **Step 1: Remove dead code paths and feature flag once default.**

- [ ] **Step 2: Update acceptance criteria checklist in design to Done.**

- [ ] **Step 3: Commit**

```powershell
git commit -m "chore: remove dual chat stacks; document unified chatbar 4.19"
```

---

## Dependency graph

```text
Task 0 (catalog + Settings)
   │
   ├─► Task 1 (usage/meter) ──► Task 2 (session headers) ──► Task 8 (Responses pilot)
   │
   └─► Task 3 (composer) ──► Task 4 (server process stream) ──► Task 5 (Workshop UI)
                                                      │
                                                      └─► Task 6 (Automation UI)
Task 7 (approvals) can parallel after Task 1 stream events exist
Task 9 after 5–7
```

---

## Self-review (plan vs design)

| Design requirement | Task |
|--------------------|------|
| Single chat surface | 5, 6, 9 |
| Page injections | 3, 5 (page module) |
| Prompt catalog + Settings | 0 |
| Stream process chat | 4 |
| Usage meter Tier A | 1 |
| Session-Key | 2 |
| Approvals | 7 |
| Responses pilot | 8 |
| Overlord on Workshop | 5 (policy) |
| Docs | 0, 1, 9 |

No intentional placeholders left in task interfaces; implementers must read live signatures in `lib/diagram.ts` / auth helpers when wiring.

---

## Execution handoff

Plan complete and saved to:

- **Design:** `docs/superpowers/specs/2026-07-22-unified-global-chatbar-design.md`
- **Plan:** `docs/superpowers/plans/2026-07-22-unified-global-chatbar.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, batch with checkpoints  

**Which approach?** Recommend starting with **Task 0** (Settings Agent prompts + catalog) — visible win, zero risk to chat, unblocks prompt transparency immediately.
