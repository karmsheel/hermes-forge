# Unified Global Chatbar — Design

> **Status:** Proposed  
> **Date:** 2026-07-22  
> **Depends on:** 4.17 Global chatbar (shipped), `GLOBAL_CHATBAR.md`, `HERMES_API_SERVER.md`  
> **Backlog id (proposed):** **4.19 Unified global chatbar**  
> **Companion plan:** `docs/superpowers/plans/2026-07-22-unified-global-chatbar.md`

---

## 1. Problem

Today the shell **dock** is shared, but Workshop (and Automation design) **swap the entire panel body** for a separate stack:

| Surface | Messages / send | Composer | Threads |
|---------|-----------------|----------|---------|
| Studio (most rooms) | `ChatbarPanel` + `/api/studio/conversations/.../chat` | Studio textarea | Studio conversations + agent |
| Workshop process | `WorkshopSession` + `ProcessChat` + `/api/processes/[id]/chat` | `RichComposer` | Process conversations / forks |
| Automation design | `AutomationChat` + automation chat API | Own composer | Not studio |

That contradicts the product rule: **one Hermes surface** with page-aware injections. Users see different chrome, different streaming behavior (process chat is non-streaming), and different agent UX. It also blocks Hermes API upgrades (usage, session keys, stop/steer) from applying uniformly.

---

## 2. Goals

1. **Single chat surface** — One `ChatbarPanel` tree for all shell routes. No process/automation early-return that replaces the panel.
2. **Page modules inject** — Each page registers **context**, **tools/commands**, and optional **prompt addons** / **pinned entity**. The shell owns chrome, history, composer FSM, meter, agent picker policy.
3. **Workshop stays powerful** — Mentions, slash commands, node targeting, forks, diagram comment dots remain — as **capabilities of the unified surface**, not a second app.
4. **Honest Hermes client** — Adopt findings from `HERMES_API_SERVER.md`: stream everywhere, parse usage, set session headers, dual-mode context meter, approvals, skills catalog later.
5. **Prompt transparency** — Settings view lists every system / page-context prompt builder Forge uses (static templates + live preview for active business/route).

### Non-goals (this epic)

- Browser DOM capture (extension-only).
- Replacing Hermes Agent with another provider.
- Full multi-agent parallel docks (desktop multi-tab may come later).
- Waiting on upstream `#15618` for live `context_tokens` (wire when shipped; design for it).

---

## 3. Target architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ AppShell                                                     │
│  ChatbarProvider                                             │
│    ├── residency / side / agent / conversation               │
│    ├── pageModule: PageChatModule | null   ← pages register  │
│    └── ChatbarPanel  (ONE UI tree always)                    │
│         header | messages | composer | desktop bar | footer  │
└─────────────────────────────────────────────────────────────┘
         ▲ registerPageModule()
         │
   WorkshopPageModule | FoundationPageModule | PlantPageModule | …
         │
         ├── context (snapshot lines, selection)
         ├── commands (slash)
         ├── mentionables
         ├── pinned entity (process / automation)
         └── promptAddonKey (server resolves real text)
```

### 3.1 One panel, many scopes

Conversation row already has `kind` (`studio` | `process` | …). Unify around:

| Scope | When | Thread binding | Agent policy |
|-------|------|----------------|--------------|
| `studio` | Default rooms | `Conversation.kind=studio`, optional pin | All hired (or Overlord-only on BM) |
| `process` | Workshop + process selected (or pin from Map) | `kind=process`, `processId` set | **Overlord locked** |
| `automation` | Automate design for a process | `kind=automation` or pin + kind | Product choice (default Overlord) |

**Critical:** scope is data + prompt, not a different React tree.

### 3.2 Page module protocol (client)

Extend today’s `registerPageContext` into a richer module (backward-compatible):

```ts
type PageChatModule = {
  routeKey: string;
  /** Untrusted snapshot + selection (existing). */
  context: PageContextRegistration;
  /** Slash commands for this page (merge with global). */
  commands?: SlashCommandSpec[];
  /** @-mention candidates when relevant. */
  mentionables?: Mentionable[];
  /** Pin process/automation so scope + server prompts specialize. */
  pin?: { type: "process" | "automation"; id: string; label: string };
  /**
   * Server prompt pack key — e.g. "workshop-process", "foundation", "default".
   * Never send full system prompt text from the client.
   */
  promptPack?: string;
  /** Optional UI chips above composer (selected node, etc.). */
  composerChrome?: { kind: "node-target"; label: string; onClear: () => void } | null;
};
```

Pages **never** own message state or send HTTP. They only register modules and handle page-side effects (diagram updates, comment maps) via events/callbacks from the chatbar.

### 3.3 Server prompt pack registry

Central catalog (source of truth for Settings + chat routes):

```ts
// lib/chatbar/prompt-catalog.ts
type PromptPackId =
  | "studio-default"
  | "foundation"
  | "map-plant"
  | "workshop-process"
  | "automation-architect"
  | "diagram-subagent"      // background only — listed as non-chatbar
  | "automation-extract"    // non-chatbar
  | "automation-deploy";    // non-chatbar

type PromptCatalogEntry = {
  id: PromptPackId;
  title: string;
  surface: "chatbar" | "background" | "job";
  routes: string[];          // e.g. ["/workshop"]
  description: string;
  /** Pure builder — same function chat routes call. */
  buildSystem: (ctx: PromptBuildContext) => string;
  /** Optional second system/user context message builder. */
  buildPageContext?: (ctx: PromptBuildContext) => string | null;
};
```

**Today’s sources to migrate into the catalog:**

| Pack | Current location |
|------|------------------|
| Studio identity + co-pilot | `lib/chatbar/studio-prompt.ts` → `buildStudioChatSystemPrompt` |
| Untrusted page envelope | `buildStudioPageContextMessage` / `context-protocol` |
| Foundation Overlord fences | `lib/foundation.ts` → `foundationStudioPromptAddon` |
| Map plant selection | inline in `studio-prompt.ts` |
| Process mapping | `lib/diagram.ts` → `buildChatSystemPrompt` |
| Diagram Mermaid subagent | `DIAGRAM_SYSTEM_PROMPT` in `lib/diagram.ts` |
| Automation architect | `lib/automation-chat.ts` |
| Automation extract / deploy | `lib/automation-extract.ts`, `lib/automation-deploy.ts` |
| Page blurbs | `lib/chatbar/page-registry.ts` |

Chat routes become thin: resolve pack → build messages → stream Hermes.

### 3.4 Unified composer

Replace dual composers with one **ChatbarComposer**:

- Studio layout (bordered box, model under field, labeled Send, stop/queue/steer).
- Always-on optional features from page module:
  - `@` mentions when `mentionables` present
  - `/` commands when `commands` present
  - node pill when `composerChrome.kind === "node-target"`
- Implement by elevating `RichComposer` internals **or** merging mention/slash into the studio textarea path — product preference: **one component**, studio chrome default.

### 3.5 Workshop without `registerProcessSession`

**Delete process early-return** after migration:

1. Workshop selects process → page module pins `{ type: "process", id, label }`.
2. Chatbar loads/creates `Conversation` with `kind=process` + `processId` (existing process conversation rows).
3. Send goes to **one** chat endpoint that branches on conversation kind **server-side** (or unified `/api/studio/conversations/[id]/chat` that already understands process).
4. Diagram agent remains a **side effect** of process turns (existing server path), not a second chat UI.
5. Forks/conversation menu: header session UI lists process conversations when pin is process (same menu component, different filter).
6. Comment dots: chatbar emits `onMessagesChange` / process events; Workshop listens — no ProcessChat mount.

### 3.6 Agent policy

| Route | Picker |
|-------|--------|
| `/business-manager` | Overlord only |
| `/workshop` | Overlord only |
| Other rooms | Hired agents (Overlord first) |

Policy lives in `isChatbarOverlordOnlyPath` + server enforcement of agent on process kind.

---

## 4. Hermes API upgrades (from `HERMES_API_SERVER.md`)

Incorporate as **first-class plan phases**, not afterthoughts.

### Tier A — Usage + meter (P0)

- Parse `usage` from non-stream + post-stream `GET /v1/runs/{id}` when available.
- SSE `usage` event to client.
- Dual-mode meter: draft **estimate** (include real system/context chars) + **last-turn Hermes usage**.
- Fix process meter `draftText: ""` by using unified composer draft.

### Tier B — Stream parity (P0)

- Process (and automation design) chat use `streamHermesEvents` like studio — tool strip, stop, steer, run_id.

### Tier C — Memory / continuity (P1)

- Header `X-Hermes-Session-Key: forge:{userId}:{businessId}:{agentProfileKey}`.
- Header `X-Hermes-Session-Id: forge-conv:{conversationId}` (or process conv id).
- Pilot `POST /v1/responses` + `previous_response_id` **or** named conversation for studio kind; keep Forge DB as UI source of truth.

### Tier D — Safety / discovery (P1–P2)

- Tool **approval** UI → `POST /v1/runs/{id}/approval`.
- Model picker copy: profile/id, not “switch provider model”.
- Skills/toolsets Settings panel from `GET /v1/skills`, `GET /v1/toolsets`.
- Optional `/health/detailed` in Settings → Hermes.

### Tier E — Blocked on Hermes

- Live remaining context / compaction (`#15618`) — watch and wire when shipped.

---

## 5. Settings: Agent prompts

New settings section: **Agent prompts** (always visible, not developer-gated).

### UI

- List catalog entries grouped by `surface` (Chatbar / Background / Jobs).
- Each row: title, routes, short description, “copy template”.
- Expand: **template** (builders with placeholders) and **live preview** (active business + optional route selector + sample selection) calling `GET /api/settings/prompt-preview?pack=…&route=…`.
- Disclaimer: live preview may include business names and truncated snapshots; never secrets/API keys (reuse redaction).

### API

- `GET /api/settings/prompt-catalog` — metadata only.
- `GET /api/settings/prompt-preview` — built system (+ optional page context) for pack; requires session + business access.

### Implementation rule

**No duplicate prompt strings.** Catalog builders are the same functions chat routes import. Settings is a viewer, not a second source of truth.

---

## 6. API shape after unification

Prefer **one interactive chat entry**:

```text
POST /api/studio/conversations/[id]/chat
  body: {
    content, replyOnly?, baseUrl, apiKey?, model?,
    contextMode, route, clientSnapshot?,
    nodeContext?,          // workshop
    slashCommand?,         // optional structured
  }
```

Server:

1. Load conversation; switch on `kind` / `processId`.
2. Resolve `promptPack` from kind + route.
3. Build system + untrusted context + history.
4. `streamHermesEvents` with session headers.
5. Side effects: diagram agent (process), plant fences (foundation), etc.
6. Emit SSE: `delta` | `tool` | `usage` | `done` | page-specific (`plant_apply`, …).

Deprecate client use of `POST /api/processes/[id]/chat` after migration (keep route as thin proxy one release if needed).

---

## 7. Migration strategy

| Phase | Deliverable | Risk control |
|-------|-------------|--------------|
| **0** | Prompt catalog + Settings viewer (read-only) | Zero chat behavior change |
| **1** | Hermes usage plumbing + stream helpers shared | Meter improves everywhere studio already streams |
| **2** | Unified composer (RichComposer features in studio chrome) | Feature-flag optional |
| **3** | Process kind via studio chat API (server) + stream | Dual client still OK |
| **4** | Workshop switches to pin + studio panel; remove process early-return | Soft flag `forge.chatbar.unifiedWorkshop` |
| **5** | Automation design into same surface | After workshop stable |
| **6** | Session-Key + Responses pilot + approvals | Independent of UI unity |
| **7** | Delete dead `ProcessChat` mount path / process-session binding | After flag default on |

---

## 8. Acceptance criteria

1. Navigating Foundation → Map → Workshop → Metrics never mounts a second chat implementation; only page modules change.
2. Workshop retains: @ mentions, slash, node target, forks, comment dots, diagram updates.
3. Workshop agent picker is Overlord-only and matches studio chrome (model under composer, meter, context chip).
4. Settings → Agent prompts lists all packs; live preview matches what a chat send would inject (unit-tested equality).
5. Process turns stream with tool activity; stop works.
6. Last-turn usage appears in meter; estimate includes system+context when composing.
7. `X-Hermes-Session-Key` set on Hermes requests for interactive chat.
8. No dual process session registration path in default path.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Process chat regressions (forge-from-chat, split, accuracy) | Port server tests; feature flag; keep process route proxy |
| Prompt drift between Settings and chat | Single catalog builders only |
| Large PR | Phases 0–7 above; ship Settings first for visibility |
| Responses API pilot complexity | Optional behind flag; Chat Completions remains default |
| Memory bleed across businesses | Session-Key mandatory before multi-agent polish |

---

## 10. Doc updates when shipping

- `docs/references/GLOBAL_CHATBAR.md` — mark PR-7+ unified surface; retire process early-return section.
- `docs/references/HERMES_API_SERVER.md` — update Forge usage column as tiers land.
- `docs/references/PRODUCT_BACKLOG.md` — add **4.19** / mark tasks.
- `docs/references/audit.md` — dual chat stack remediation.
- `docs/references/INDEX.md` — already lists HERMES_API_SERVER; link this design from GLOBAL_CHATBAR.

---

## 11. Decision log

| Decision | Choice | Why |
|----------|--------|-----|
| One React tree | Yes | Product + maintenance |
| Page injects vs page owns chat | Inject only | Shell ownership |
| Process conversations | Keep `kind=process` rows | Avoid data migration churn |
| Prompt catalog | Shared builders | Settings honesty |
| Overlord on Workshop | Locked | User requirement |
| Responses API | Pilot after stream parity | High impact, higher risk |
