# Hermes Forge — Product Backlog

Implementation plan adapted from [Open Design](https://github.com/nexu-io/open-design) (nexu-io/open-design). Open Design is an agent-native design workspace: brief → scenario/template → streaming artifact → critique → deliver. Hermes Forge applies the same philosophy to **business process mapping** with Hermes Agent.

**Reference screenshot:** `Screenshot 2026-06-30 161549.png` (project root)  
**Open Design key paths:** `apps/web/src/styles/tokens.css`, `apps/web/src/components/HomeHero.tsx`, `apps/web/src/components/EntryNavRail.tsx`, `apps/web/src/components/EntryShell.tsx`, `apps/web/src/components/home-hero/chips.ts`

**Repo health audit:** [`audit.md`](audit.md) — mistakes, missing features, redundancy, and **AUDIT-*** remediation tracker (updated 2026-07-07 session).

---

## Concept mapping

| Open Design | Hermes Forge equivalent |
|-------------|-------------------------|
| Design artifact (prototype, deck) | Process diagram + workflow map |
| `DESIGN.md` brand contract | Project brief / `PROCESS.md` standards |
| Skill / plugin scenario | Workflow template (onboarding, ops, sales, etc.) |
| Studio preview panel | Mermaid diagram (workshop center) |
| Chat with agent | Hermes process chat (workshop right) |
| Recent projects | Recent businesses on home (`RecentProjectsStrip` — legacy "project" label) |
| Design system picker | Process notation / industry standards picker |

---

## Terminology (read before coding)

The codebase uses three names for related concepts. **Prefer these in new code and docs:**

| Concept | Database / API | UI label | Notes |
|---------|----------------|----------|-------|
| Tenant (one mapped business) | `Business` | "business" | Cookie-scoped active business per user |
| Workflow map | `Process` | "process" | Lives under a function (department) |
| Business area / department | `Process.department` | "function" | `/functions` aggregates processes by department |
| Shell mode (Phase 5) | `ForgeStage` | **room** (target) | Map / Monitor / Automate (+ Foundation); see [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) |
| Process lifecycle | `lifecycleStatus` | draft / refined / **forged** | Forged soft-unlocks Monitor + Automate |
| Foundation co-pilot | (prompt / persona) | **Underlord** | Agent identity in Foundation — **not** a room name |

**Legacy aliases:** some file names still say "project" (e.g. `RecentProjectsStrip.tsx`, `project-card-thumb.ts`) but UI copy and CSS use business/process. `/projects` redirects to `/functions`. Code may still say “stage” until 6.6/6.7 renames chrome to **room**.

**Redirects:** `/interview` → `/home`; `/dashboard` → `/functions` (dashboard merged into Functions page).

---

## Current codebase (baseline)

*Last aligned with codebase: v0.2.0 + post-release WIP (personnel, themes). Audit remediation session: 2026-07-07 — see [Audit remediation](#audit-remediation-2026-07-07).*

### Shell & navigation

| Area | Path | Notes |
|------|------|-------|
| App shell | `app/(shell)/layout.tsx`, `components/shell/AppShell.tsx` | Left nav rail + content area |
| Nav rail | `components/shell/NavRail.tsx` | Stage/room-scoped main items + footer Log/Decisions (+ God Mode → Map under 6.6; Cronalytics dev-gated) |
| Business manager | `app/(shell)/business-manager/page.tsx` | Multi-business switcher; logo links here |
| Settings | `app/(shell)/settings/page.tsx`, `components/settings/*` | Appearance, About, Developer panels |
| Theme engine | `lib/themes/*`, `components/theme/ThemeProvider.tsx` | Built-in skins, JSON/VS Code install, boot script (4.6–4.8) |

### Core product loop

| Area | Path | Notes |
|------|------|-------|
| Home | `app/(shell)/home/page.tsx` | Hero composer, templates, recent businesses strip |
| Start from brief | `app/api/start-from-brief/route.ts`, `lib/start-from-brief.ts` | Atomic business + process + seed messages |
| Functions | `app/(shell)/functions/page.tsx` | Org chart by department + automation analytics (merged dashboard); replaces `/projects` and `/dashboard` |
| Workshop | `app/(shell)/workshop/page.tsx` | 3-column: sidebar / diagram+tabs / chat |
| Process sidebar | `components/workshop/ProcessSidebar.tsx` | Process list + function filter |
| Process chat | `components/workshop/ProcessChat.tsx` | Hermes chat, rich composer, message queue |
| Mermaid diagram | `components/workshop/MermaidDiagram.tsx` | Streaming diagram, node comments |
| Workspace tabs | `components/workshop/WorkspaceTabs.tsx` | Diagram, Details, Questions, Source, Export |
| New business modal | `components/projects/NewBusinessDialog.tsx` | Name + description + avatar |
| Hermes connection | `components/hermes/*`, `app/api/hermes/**` | BYOK OpenAI-compatible proxy |
| Client state | `lib/workshop-storage.ts` | Per-business `activeProcessId`, conversation, function filter |

### Automations & governance

| Area | Path | Notes |
|------|------|-------|
| Automations list | `app/(shell)/automations/page.tsx` | Approved processes → automation studio |
| Automation studio | `app/(shell)/automations/[processId]/page.tsx` | Design chat, n8n deploy, credentials |
| Business log | `app/(shell)/log/page.tsx`, `lib/business-log.ts` | Append-only immutable event feed |
| Git materialize | `lib/business-git/*` | Per-business repo snapshot; local sync + remote push + restore import |
| Decisions | `app/(shell)/decisions/page.tsx` | **Shipped** (4.12 HITL) — inbox + history; always in nav footer |
| God Mode | `app/(shell)/god-mode/page.tsx` | Compact plant canvas (today dev-gated); **6.6 promotes into Map** — see [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) |
| Cronalytics | `app/(shell)/cronalytics/page.tsx` | **Dev-gated** — Hermes cron observability; separate SQLite DB |

### Personnel (scaffold — not integrated)

| Area | Path | Notes |
|------|------|-------|
| Personnel page | `app/(shell)/personnel/page.tsx` | Human roster + Hermes agent scan/hire/fire |
| Personnel API | `app/api/personnel/**` | Humans CRUD; agents scan/hire/fire; icon PATCH |
| Personnel lib | `lib/personnel/*` | Owner bootstrap, Hermes profile scan, icon catalog |
| DB models | `HumanPersonnel`, `HermesAgentProfile` in `prisma/schema.prisma` | **Not wired** to workshop, swimlanes, automations, or chat mentions |

### Platform

| Area | Path | Notes |
|------|------|-------|
| Auth / session | `lib/auth.ts`, `lib/auth-session.ts`, `middleware.ts` | Cookie JWT; active business cookie |
| API surface | `app/api/**` | ~52 route handlers |
| Global styles | `app/globals.css`, `app/tokens.css` | Design tokens + skin overrides |
| DB schema | `prisma/schema.prisma` | User, Business, Process, Conversation, ChatMessage, Automation, Memory, BusinessEvent, BusinessDecision, HumanPersonnel, HermesAgentProfile |
| Desktop | `electron/main.mjs`, `electron/preload.mjs` | Electron wrapper; standalone Next on port 3847; NSIS installer unsigned → 4.16 / [`WINDOWS_CODE_SIGNING.md`](WINDOWS_CODE_SIGNING.md); multi-tab → 4.15 / [`DESKTOP_MULTI_TAB_SHELL.md`](DESKTOP_MULTI_TAB_SHELL.md) |
| Redirects | `next.config.ts` | `/projects` → `/functions`, `/businesses` → `/functions`, `/interview` → `/home`, `/dashboard` → `/functions` |

---

## Design principles (from Open Design — keep these)

1. **Agent-native, not agent-bundled** — Hermes is the engine; Forge is the studio shell.
2. **Local-first / BYOK** — User brings their own Hermes endpoint; no forced cloud.
3. **Business isolation** — Each business owns processes, chats, and client state. (Legacy UI still says "project" in places.)
4. **Neutral chrome, rich artifact** — UI stays minimal; the diagram carries visual weight.
5. **Accent discipline** — Orange (`--accent`) for primary CTAs only; blue (`--selected`) for selected states; green for success/status.
6. **Discover → lock → stream → critique → deliver** — Brief/home → diagram → chat corrections → export.

---

## Phase 1 — Visual foundation

### 1.1 Token-based theme (dark + orange accent) — **DONE**

**Goal:** Replace ad-hoc `zinc-*` / `emerald-*` / light Vercel globals with a single token system inspired by Open Design `tokens.css`.

**Files to create/modify:**
- `app/tokens.css` — CSS custom properties (surfaces, text, accent, semantic colors, radius, motion)
- `app/globals.css` — Import tokens; map `.card`, `.btn-primary`, `.btn-secondary`, `.input` to tokens; `@theme inline` for Tailwind utilities
- `app/layout.tsx` — `data-theme="dark"` on `<html>` (workspace default)

**Token naming (use these in CSS and Tailwind):**

| Token | Dark value (default) | Usage |
|-------|---------------------|-------|
| `--bg` | `#1a1917` | App background |
| `--bg-panel` | `#222120` | Panels, sidebars |
| `--bg-elevated` | `#2a2825` | Cards, modals, composer |
| `--bg-subtle` | `#252321` | Hover states |
| `--border` | `#333128` | Default borders |
| `--border-strong` | `#46433c` | Emphasized borders |
| `--text` | `#e8e4dc` | Primary text |
| `--text-muted` | `#9a9690` | Secondary text |
| `--text-faint` | `#4e4b46` | Tertiary / placeholders |
| `--accent` | `#d97a56` | Primary CTA (Send, Create) |
| `--accent-hover` | `#e8896a` | CTA hover |
| `--selected` | `#2563eb` | Selected option / focus ring |
| `--green` | `#4caf72` | Connected / success |
| `--amber` | `#e09a40` | Warning / needs input |
| `--red` | `#e06b65` | Error |

**Tailwind utilities (via `@theme`):** `bg-bg`, `bg-bg-panel`, `bg-bg-elevated`, `text-text`, `text-text-muted`, `border-border`, `bg-accent`, `text-accent`, etc.

**Acceptance criteria:**
- [x] All semantic classes (`.card`, `.btn-primary`, `.btn-secondary`, `.input`) use tokens
- [x] `.btn-primary` uses orange accent, not black/white
- [x] Body defaults to dark theme; text is readable on all dark surfaces
- [x] Main pages migrated off raw `zinc-950` / `emerald-*` where they represent theme colors
- [x] `npm run build` passes

**Note:** Light/dark/system mode toggle shipped later via `ThemeProvider` + `NavThemeModeToggle` (4.6). Skins override token colors at runtime.

---

### 1.2 App shell with left icon rail — **DONE**

**Goal:** Persistent narrow left rail like Open Design `EntryNavRail.tsx`.

**Files:** `components/shell/AppShell.tsx`, `components/shell/NavRail.tsx`, `components/shell/ShellContext.tsx`, `components/shell/AppTopBar.tsx`, `app/(shell)/layout.tsx`

**Rail items (current):**
- Logo → `/business-manager`
- **+** New process (opens modal)
- Home → `/home`
- Functions → `/functions` (was `/projects`; redirect in place)
- Personnel → `/personnel`
- Documents → `/documents` (4.18 knowledge docs)
- Workshop → `/workshop`
- Automations → `/automations`
- Business log → `/log` (holistic footer — all stages)
- Decisions → `/decisions` (holistic footer — all stages; 4.12 HITL)
- God Mode → `/god-mode` (developer setting)
- Cronalytics → `/cronalytics` (developer setting)
- Footer: Hermes chat toggle, version / update meta

**Acceptance criteria:**
- [x] Rail visible on shell routes (home, functions, workshop, etc.)
- [x] Active route highlighted with `--accent-tint` background
- [x] Collapsible to icon-only on narrow viewports (56px rail, tighter on mobile)

**Depends on:** 1.1

---

### 1.3 Hero home with prompt composer — **DONE**

**Goal:** Centered home like Open Design `HomeHero` — not a left-aligned admin list.

**Files:** `app/(shell)/home/page.tsx`, `components/home/HomeHero.tsx`, `components/home/PromptComposer.tsx`, `lib/home-prompt.ts`, `lib/start-from-brief.ts`

**UI elements:**
- Headline: "What process will you map today?"
- Subtitle: "Map how your business actually works."
- Large elevated composer card (textarea)
- Orange Send button
- Placeholder carousel (rotating example prompts)

**Acceptance criteria:**
- [x] `/` redirects to hero home (logged in) or login (logged out)
- [x] Composer is visually dominant (centered, max-width ~640px)
- [x] Send is disabled without text + Hermes connection
- [x] Home vs Functions separated in nav rail (`/home` vs `/functions`)
- [x] Brief from home auto-sends first message in workshop

**Depends on:** 1.1, 1.2

---

### 1.4 Recent projects strip with status cards — **DONE**

**Goal:** Bottom section like Open Design `RecentProjectsStrip` + screenshot project cards.

**Files:** `components/home/RecentProjectsStrip.tsx`; extend `BusinessSummary` type / API if needed.

**Card fields:**
- Gradient/color thumbnail (hash from project name)
- Project name (truncated)
- Status pill: `Mapping` | `Needs input` | `Completed` | `Not started`
- Relative timestamp (`7m ago`)
- Workflow count

**Acceptance criteria:**
- [x] Shows last 4 projects on home
- [x] "View all ›" links to `/functions`
- [x] Click card opens project in workshop

**Depends on:** 1.3, D2 (status lifecycle — can stub statuses initially)

---

### 1.5 Template starter cards — **DONE**

**Goal:** Horizontal scroll of illustrated starter cards below composer.

**Files:** `components/home/TemplateCards.tsx`, `lib/workflow-templates.ts`

**Initial templates:**
| ID | Title | Description | Seeds |
|----|-------|-------------|-------|
| `sop` | SOP | Standard operating procedures | Prompt + empty BPMN-ish diagram |
| `customer-journey` | Customer journey | End-to-end customer flow | Prompt |
| `approval-flow` | Approval flow | Sign-off chains | Prompt |
| `onboarding` | Onboarding | New hire / customer onboarding | Prompt |
| `incident` | Incident response | Ops escalation | Prompt |
| `blank` | Blank process | Start from scratch | Opens New Project modal |

**Acceptance criteria:**
- [x] Clicking card pre-fills composer or creates project+process with template metadata
- [x] "...or start a blank project ›" link opens `NewProjectDialog`
- [x] Horizontal scroll of illustrated cards below composer
- [x] Send passes template id + optional starter diagram to workshop flow

**Depends on:** 1.3

---

## Phase 2 — Home → workshop flow

### 2.1 Send creates project + process + opens workshop — **DONE**

**Goal:** One action from home composer (like Open Design home Send).

**Files:** `app/api/start-from-brief/route.ts`, `lib/start-from-brief.ts`, `components/home/HomeHero.tsx`, `app/api/processes/[id]/chat/route.ts`

**Flow:**
1. User types brief, optionally picks template
2. POST `/api/start-from-brief` — atomic create business + process + seed messages
3. Brief stored as first user message; welcome assistant message seeded
4. Set active business cookie + client active process id
5. Navigate to `/workshop`; workshop auto-triggers Hermes reply (`replyOnly`)

**Acceptance criteria:**
- [x] Single Send action from home creates project and workflow
- [x] Template metadata + optional starter diagram passed through
- [x] Active business cookie set server-side
- [x] Workshop opens on new process with brief visible in chat
- [x] Hermes reply auto-fired when connected

**Depends on:** 1.3, 1.5, B1

---

### 2.2 Process standards / notation picker — **DONE**

**Goal:** Footer control like Open Design "No design system" — "Process standard: Model picks".

**Files:** `components/home/ProcessStandardPicker.tsx`, `lib/process-standards.ts`, `lib/diagram.ts`

**Options (v1):** Model picks (default), BPMN-lite, Swimlane, Simple flowchart

**Acceptance criteria:**
- [x] Footer picker on home composer
- [x] Default is "Model picks" (`auto`)
- [x] Selection persists in localStorage
- [x] Send passes standard through start-from-brief (tag when explicit)
- [x] Chat + diagram agents apply standard-specific prompt rules

**Depends on:** 1.3, G2 (PROCESS.md — can stub)

---

### 2.3 Inline Hermes model switcher in header — **DONE**

**Goal:** `InlineModelSwitcher` in top bar, not buried in dialog only.

**Files:** `components/hermes/HermesModelSwitcher.tsx`, `lib/hermes-models.ts`, `app/api/hermes/models/route.ts`, update `HermesConnectionProvider`

**Acceptance criteria:**
- [x] Model dropdown in `AppTopBar` (home, functions, dashboard, etc.)
- [x] Model switcher also in workshop and automations headers (no top bar on those routes)
- [x] Fetches models from Hermes `GET /v1/models` when connected
- [x] Selected model persisted in `localStorage` via `HermesConfig.model`
- [x] All Hermes API calls pass selected model through to chat completions

**Depends on:** 1.2

---

### 2.4 Function status lifecycle badges — **DEFERRED**

**Goal:** Consistent status pills across home cards and the functions list (`/functions`).

**Note:** UI uses **Functions** (business areas) not "projects". Processes live inside a function.

**Files:** `lib/function-status.ts` (or extend status helpers), home strip + functions list

**Statuses:** `not_started` | `mapping` | `needs_input` | `review` | `completed`

**Derived rules (v1, no new DB field):**
- `not_started` — 0 processes
- `mapping` — has processes, latest updated < 24h
- `needs_input` — last message role is `assistant` asking question (heuristic)
- `completed` — user-marked or all processes have diagrams + confirmed names

**Depends on:** 1.4

---

## Phase 3 — Workshop depth

### 3.1 Streaming diagram updates — **DONE**

**Goal:** Partial Mermaid renders while Hermes generates (Open Design staged preview).

**Files:** `app/api/processes/[id]/diagram/route.ts`, `lib/diagram-stream.ts`, `lib/hermes-stream.ts`, `lib/mermaid-partial.ts`, `components/workshop/MermaidDiagram.tsx`, `app/(shell)/workshop/page.tsx`

**Acceptance criteria:**
- [x] Diagram subagent streams from Hermes (`stream: true` on chat completions)
- [x] SSE endpoint emits `preview` events with partial Mermaid and `done` with final diagram
- [x] Workshop updates the diagram live during background agent runs
- [x] MermaidDiagram shows a "Drawing…" indicator without blocking the whole canvas
- [x] Non-streaming JSON mode preserved for backwards compatibility

**Depends on:** 2.1

---

### 3.2 Node-level comments / corrections — **DONE**

**Goal:** Click Mermaid node → annotate → agent revises that step.

**Files:** `components/workshop/DiagramComments.tsx`, `components/workshop/MermaidDiagram.tsx`, chat API + workshop page

**Shipped:** Clickable nodes, accent highlight, composer pill + `Regarding "…"` prefix, comment dots, `nodeContext` on chat API, diagram regen from conversation history.

---

### 3.3 Discovery Questions panel — **DONE**

**Goal:** Offload discovery from chat to dedicated tab (Open Design `QuestionsPanel`).

**Files:** `components/workshop/QuestionsPanel.tsx`, `WorkspaceTabs`, `lib/process-discovery.ts`, `lib/diagram.ts`, chat + diagram APIs

**Shipped:** Questions tab (trigger, systems, manual steps, output); PATCH save on process; discovery answers injected into chat + diagram agent prompts.

**Questions:** Who triggers this? What systems? What's manual? What's the output?

---

### 3.4 Conversation fork / multiple threads — **DONE**

**Goal:** Fork process mapping from any chat turn; multiple conversations per process.

**Files:** `prisma/schema.prisma` (`Conversation`), `app/api/processes/[id]/conversations/**`, `components/workshop/ConversationsMenu.tsx`, `components/workshop/ProcessChat.tsx`, `lib/conversation-fork.ts`, `lib/workshop-storage.ts`

**Shipped:**
- [x] Conversation model; fork API; conversation switcher in chat header
- [x] Per-process active conversation persistence; chat/diagram filtered by `conversationId`
- [x] Export tab uses active conversation messages when forks exist
- [x] Fork-from-specific-message UI on chat bubbles (`forkAtMessageId`)
- [x] Rename conversation (PATCH)
- [x] Delete conversation (cannot delete the last thread)

---

### 3.5 Rich composer (mentions + slash commands) — **MOSTLY DONE**

**Goal:** `@department`, `@system` mentions; `/add-step`, `/export` slash commands.

**Files:** `components/workshop/rich-composer/*`, `ProcessChat.tsx`

**Shipped:** `RichComposer` with `@` autocomplete (diagram step nodes), slash commands (`/help`, `/name`, `/add-step`, `/simplify`, `/export`, `/split`, `/accuracy`), suggestion popover, node context pill.

**Remaining:**
- [x] `@system` mentionables (from Questions “Systems involved”, known tools, diagram labels)
- [x] `@department` / actor mentionables (via personnel roster — 4.10)
- [ ] `/export` format args (e.g. pdf) if server export is added (3.8)

---

### 3.6 Workspace tabs — **DONE**

**Goal:** Tab strip above diagram: Diagram | Details | Questions | Source | Export

**Files:** `components/workshop/WorkspaceTabs.tsx`, `DetailsPanel.tsx`, `SourcePanel.tsx`, `app/(shell)/workshop/page.tsx`

**Shipped:** Full tab strip with all five panels wired in the workshop center column.

---

### 3.7 Queued messages while agent runs — **DONE**

**Goal:** Queue clarifications during diagram/naming agent runs.

**Files:** `components/workshop/MessageQueue.tsx`, `lib/message-queue.ts`, `app/(shell)/workshop/page.tsx`

**Implemented:**
- While chat is loading or diagram/naming subagents run, the composer stays editable and Send queues instead of blocking.
- `MessageQueue` panel above the composer shows queued items with node badges, remove, and clear-all.
- FIFO drain sends queued messages once chat and background agents are idle; queue clears on process/conversation switch.

**Acceptance criteria (met):**
- [x] User can type clarifications while agents run
- [x] Queued messages visible with remove/clear
- [x] Queue drains automatically when idle
- [x] Build passes

---

### 3.8 Export handoff — **DONE** (client-side)

**Goal:** Export Mermaid, PNG, PDF, Markdown SOP; optional "Open in Cursor" context bundle.

**Files:** `components/export/ExportMenu.tsx`, `lib/export-diagram.ts` (Export workspace tab)

**Shipped:** Markdown SOP, Mermaid source, PNG diagram, PDF diagram, Cursor JSON bundle; copy/download; "Open in Cursor" prompt; `/export` slash command opens Export tab; scope to active conversation when forks exist.

**Notes:** PNG/PDF use client-side Mermaid → SVG → canvas (and a minimal PDF wrapper). Server-side `app/api/processes/[id]/export/route.ts` deferred — not required for desktop/BYOK deliverables.

---

### 3.9 Diagram multi-flow split — **DONE** (foundation)

**Goal:** When a single process Mermaid contains multiple independent workflows, peel one flow into a **new** process and leave a single coherent flow on the parent (same parent `id`). Shared API for UI and agent/chat.

**Files:** `lib/mermaid-graph.ts`, `lib/process-split.ts`, `app/api/processes/[id]/split/route.ts`, `components/workshop/SplitProcessDialog.tsx`, `WorkshopSession.tsx`, chat prompt injection in `lib/diagram.ts` + `app/api/processes/[id]/chat/route.ts`

**Shipped:**
- [x] Deterministic graph analysis (connected components) → `canSplit` / `showSplitButton` (high confidence on disconnected multi-flow)
- [x] API: `GET` analyze; `POST` `action=plan|apply|analyze` (plan preview, apply with optional plan body)
- [x] Workshop banner + header **Split** when multi-flow detected; modal plan → preview Mermaid → confirm
- [x] Slash `/split` (optional instruction args)
- [x] Chat intercept still executes on user request / confirm after assistant proposes split
- [x] Split analysis injected into process chat system prompt when multi-flow
- [x] Forged/approved maps may be split; parent reopens as **draft** (clears `approvedAt`) after apply
- [x] Unit tests: `tests/unit/mermaid-graph.test.ts`

**Remaining (optional):**
- [ ] Deterministic extract-by-`nodeIds` (peel selected subgraph without full LLM rewrite)
- [ ] Multi-way split (N components → N−1 children in one pass, or guided sequential peels)
- [ ] Soft “maybe multi-trigger” affordance for medium-confidence single-component graphs

**Do not:** Clone full chat history onto the child; invent steps not present in the source diagram during apply.

---

## Phase 4 — Extensibility

### 4.1 Workflow template library — **DONE** (foundation)

**Goal:** Curated templates as repo files (`templates/workflows/*.json`).

**Shipped:** JSON templates under `templates/workflows/`; loaded by `lib/workflow-templates.ts` into home TemplateCards.

---

### 4.2 PROCESS.md contract — **DONE** (foundation)

**Goal:** Per-business `PROCESS.md` schema: notation, actors, systems, automation goals.

**Schema sections:** Overview, Actors, Systems, Notation, Anti-patterns, Export format

**Shipped:**
- [x] `lib/process-md.ts` — generate contract from business + processes + personnel
- [x] Git materialize writes root `PROCESS.md`
- [x] Chat system prompt injects truncated contract
- [x] Schema reference: `docs/references/PROCESS.md`

**Remaining (optional):** editable UI for overrides; persist custom contract on Business.

---

### 4.3 Template marketplace / import

**Goal:** Share and import community workflow templates.

---

### 4.4 Automations page — **DONE** (shipped ahead of Phase 4)

**Goal:** Approved process maps → automation design studio with n8n deploy.

**Route:** `/automations`, `/automations/[processId]`

**Shipped:** Approval flow in workshop, automations list, automation studio, n8n connection, deploy APIs.

---

### 4.5 Integrations page

**Goal:** MCP / external connectors for process discovery.

**Route:** `/integrations`

---

### 4.6 Hermes Desktop skin engine (built-ins) — **DONE**

**Goal:** Replace accent swatches with Hermes Desktop's built-in skins via a compatibility bridge that maps skin palettes onto existing Forge CSS vars (`--bg`, `--accent`, etc.).

**Files:** `lib/themes/*`, `components/theme/ThemeProvider.tsx`, `components/theme/ThemeScript.tsx`, `components/settings/SettingsMenu.tsx`, `components/workshop/MermaidDiagram.tsx`

**Shipped:** 10 built-in skins (`iron-ember` default + 9 presets), flashless boot script, accent→skin migration, Mermaid reads computed theme tokens. Most presets are dark-only in the skin picker when mode = Light.

**Reference:** `docs/references/hermes-desktop-design-system.md`

**Depends on:** 1.1

---

### 4.7 User theme install (JSON) — **DONE**

**Goal:** Install custom skins from pasted or uploaded JSON (localStorage registry, same seam as Hermes Desktop `user-themes.ts`).

**Files:** `lib/themes/user-themes.ts`, `lib/themes/validate.ts`, `components/settings/SkinInstallDialog.tsx`, `docs/references/THEME_SCHEMA.md`

**Shipped:** JSON paste/upload install, installed-themes list with remove, merged skin registry, flashless boot for user themes.

**Depends on:** 4.6

---

### 4.8 VS Code theme import (Electron) — **DONE**

**Goal:** Import VS Code color themes when running packaged Electron; optional Marketplace IPC.

**Files:** `lib/themes/vscode.ts`, `lib/themes/install.ts`, `electron/main.mjs`, `electron/preload.mjs`, `components/settings/SkinInstallDialog.tsx`

**Shipped:** VS Code JSONC parser + workbench token converter; unified install path (Forge or VS Code); Electron native file picker via IPC. Marketplace deferred.

**Depends on:** 4.7, desktop packaging

---

### 4.9 UI primitive convergence (optional) — **DONE** (foundation)

**Goal:** Gradually adopt Hermes Desktop primitives (`Button`, `ListRow`, `shadow-nous`) without blocking theme functionality.

**Files:** `components/ui/*`, `app/tokens.css` (`--shadow-nous`, `--stroke-nous`), settings/theme dialogs

**Shipped:** `Button`, `Overlay`, `SegmentedControl`, `ListRow` primitives; elevation tokens; Settings appearance control + skin install dialog migrated. Broader workshop/shell migration remains incremental.

**Depends on:** 4.6

---

### 4.10 Personnel roster — **DONE** (workshop + automation bind)

**Goal:** Org roster for humans and hired Hermes agents; feed swimlanes, `@actor` mentions, and automation assignment.

**Status:** UI, API, DB, workshop integration, automation agent bind, and **`@system` mentionables** shipped.

**Files:** `app/(shell)/personnel/page.tsx`, `app/api/personnel/**`, `components/personnel/*`, `lib/personnel/*`, `prisma/schema.prisma` (`HumanPersonnel`, `HermesAgentProfile`)

**Shipped:**
- [x] Personnel nav + page: human add/fire, icon picker
- [x] Owner bootstrap on business create/import/seed (`lib/personnel/ensure-owner.ts`)
- [x] Hermes agent filesystem scan, hire/fire, icon on profile
- [x] Business log events: `personnel.added`, `personnel.hired`, `personnel.updated`, `personnel.fired`
- [x] Git export writes `personnel.json` (`lib/business-git/materialize.ts`)
- [x] Workshop `@` mentions for actors (humans + hired agents) and roles/departments
- [x] Inject personnel context into chat + diagram agent prompts
- [x] Swimlane / auto notation: prefer roster lanes in diagram system prompt
- [x] Hire dialog + page copy aligned with workshop wiring
- [x] Human edit PATCH (name, role, `roleDescription`); display description on cards

**Remaining:**
- [x] `Automation` → `hermesAgentProfileId` for hired agents (studio picker + cron prompt + deploy gate)
- [x] Import `personnel.json` on business git import (4.11 restore)
- [x] Explicit `@system` mentionables (beyond roster roles) — see 3.5 / `lib/systems.ts`

**Shipped (agent bind):** Deploy panel agent picker; `PATCH /api/processes/[id]/automation`; Hermes cron deploy requires hired agent; cron prompt injects agent identity; list shows assigned agent; git meta includes agent profile key.

---

### 4.11 Immutable business log — **MOSTLY DONE** (shipped outside backlog)

**Goal:** Append-only audit trail per business; foundation for Git versioning and governance.

**Files:** `lib/business-log.ts`, `lib/business-log-types.ts`, `app/(shell)/log/page.tsx`, `app/api/business/log/route.ts`, `lib/business-git/*`

**Shipped:**
- [x] `BusinessEvent` model with sequence, hashes, metadata
- [x] Log feed UI with type filters (`components/log/BusinessLogFeed.tsx`)
- [x] Events emitted across business/process/automation/personnel actions
- [x] Git materialize exports log + snapshot files per business
- [x] Remote Git push (`pushBusinessGitRepo`, Profile Sync/Push + remote settings)
- [x] Round-trip restore import from repo path or remote clone (`importBusinessFromGitRepo`, `POST /api/businesses/import/git`) — personnel, documents, processes, conversations, automations, memories, decisions, log events

**Remaining:**
- [x] Emit `decision.*` events when Decisions feature ships (4.12) — `decision.requested` / `recorded` / `redirected`
- [ ] Optional: incremental materialize (append log tail only)
- [ ] Optional: OAuth-managed GitHub tokens (today uses system Git credentials / SSH)

**Reference:** `docs/references/BUSINESS_LOG_AND_GIT.md`

---

### 4.12 Business decisions / HITL — **DONE**

**Goal:** Human-in-the-loop: forge processes/docs; agents propose changes; owner approves/rejects/redirects; notifications.

**Shipped:**
- [x] Lifecycle `draft | refined | forged` for processes (legacy mapping/reviewed/approved normalized)
- [x] Document `lifecycleStatus` + forge button
- [x] `DecisionRequest` + resolve with custom options + auto-execute
- [x] `BusinessDecision` records + business log
- [x] Notifications + shell bell
- [x] Decisions always in nav footer (Map / Monitor / Automate); `/decisions` inbox + history
- [x] Gate: agent writes to forged assets blocked; owner live edit with confirm + decision log
- [x] Auto-propose when agents change forged content; redirect opens chat session
- [x] Git materialize decision records + requests
- [x] `decision.requested` / `decision.recorded` / `decision.redirected` log events

**Optional later:** supersede/revoke UI; freeform “record a policy decision” without a HITL request.

---

### 4.13 God Mode process overview — **DONE** (dev-gated)

**Goal:** Zoomable canvas of all process diagrams grouped by department/function.

**Route:** `/god-mode`

**Files:** `app/(shell)/god-mode/page.tsx`, `components/god-mode/GodModeCanvas.tsx`

**Note:** Dev-gated in nav (Settings → Developer → Show God Mode). Overlaps with Functions org chart; kept for diagram canvas power users.

---

### 4.14 Cronalytics (Hermes cron observability) — **DONE** (dev-gated)

**Goal:** Dashboard for Hermes cron job health, trends, and model usage.

**Route:** `/cronalytics` (visible when developer setting enabled)

**Files:** `app/(shell)/cronalytics/page.tsx`, `lib/cronalytics/*`, `app/api/cronalytics/**`, `data/cronalytics-facts.db`

**Note:** Separate SQLite DB from main Prisma DB. Power-user / operator tooling, not core BPM.

---

### 4.15 Desktop multi-tab shell — **DONE** (Phase 1–3)

**Goal:** Notion/open-design-style tab bar in the Electron desktop app so users can work on different businesses or aspects of a business **at the same time**, with background Hermes chat/diagram streams continuing in inactive tabs.

**Status:** Shipped. Phase 1 tab chrome + business header; Phase 2 parallel `WorkshopSession` multi-mount; Phase 3 drag-reorder, context menu, open-in-new-tab from cards, LRU unload, inactive toast mute. Optional later: automation studio multi-mount.

**Reference:** [`docs/references/DESKTOP_MULTI_TAB_SHELL.md`](DESKTOP_MULTI_TAB_SHELL.md)

**Depends on:** 4.8 (desktop packaging), workshop (Phase 3), active business cookie model (today's baseline)

**Key deliverables:**
- [x] `ForgeTabProvider` + `ForgeTabBar` (desktop-gated via `isForgeDesktop()`) — Phase 1
- [x] `X-Forge-Business-Id` header + `forgeFetch` for per-tab API scoping — Phase 1
- [x] `WorkshopSession` extraction + `ForgeTabOutlet` multi-mount for true parallel streams — Phase 2
- [x] Tab-aware `NavRail`; tab persistence across app restart — Phase 1
- [x] Phase 3 polish: drag-reorder, open-in-new-tab from cards, memory guard, context menu

**Do not:** Implement via Electron `BrowserView` partitions (duplicates providers, heavy memory). Prefer in-renderer mounted sessions per the reference doc.

---

### 4.16 Windows installer code signing — **PLANNED**

**Goal:** Sign the NSIS installer and all bundled Windows executables so SmartScreen shows a verified publisher instead of "unknown publisher," and so `electron-updater` can verify update signatures.

**Status:** Investigated 2026-07-07; not implemented. Full context, certificate options, env vars, and checklist in the reference doc below.

**Reference:** [`docs/references/WINDOWS_CODE_SIGNING.md`](WINDOWS_CODE_SIGNING.md)

**Depends on:** 4.8 (desktop packaging), manual GitHub Releases workflow (`AGENTS.md`)

**Problem today:** v0.2.3 builds are entirely unsigned (`Get-AuthenticodeSignature` → `NotSigned` on installer and app exe). `electron-builder` has no `WIN_CSC_LINK` / `forceCodeSigning` configuration.

**Key deliverables:**
- [ ] Obtain Authenticode certificate (OV `.pfx` or Azure Trusted Signing)
- [ ] Store signing credentials securely (env vars locally; GitHub Secrets when CI exists)
- [ ] Add `forceCodeSigning: true` and `win.signtoolOptions.publisherName` to `package.json`
- [ ] Verify signed installer (`Status: Valid`) before each GitHub Release publish
- [ ] Update `AGENTS.md` release checklist with signing pre-flight + post-build verification

**Expectations:** Signing fixes the unknown-publisher dialog; first releases may still show SmartScreen "unrecognized app" until publisher reputation builds (EV no longer grants instant trust as of 2026).

---

### 4.17 Global chatbar — shell-level Hermes co-pilot — **DONE**

**Goal:** Elevate Hermes chat from workshop-only to a **first-class shell citizen**: right dock on every shell page, open/collapse from the left nav rail, page-aware context (intros + “help me use this company data”), and extension-parity composer UX (stop/queue/steer, tool activity strip, context receipts).

**Status:** **PR-1–PR-6 shipped** — shell chatbar epic complete (model dock, context meter, capability-gated steer, diagnostics).

**Reference:** [`docs/references/GLOBAL_CHATBAR.md`](GLOBAL_CHATBAR.md)

**Inspired by:** [hermes-browser-extension](https://github.com/abundantbeing/hermes-browser-extension) side panel (v0.1.10).

**Depends on:** 1.2 (shell), Phase 3 chat/composer, Hermes connection, design tokens (1.1 / 4.6)

**Key deliverables (see reference for full parity checklist + PR-1…PR-6):**
- [x] Shell right dock + open/collapsed residency + nav rail toggle + edge restore tab (**PR-1**)
- [x] Business-scoped studio conversations + streaming send (**PR-2**)
- [x] `hermes.forge.context.v1` page context protocol + first-visit intros + “What Hermes used” receipts (**PR-3**)
- [x] Composer FSM (stop / queue) + Tool Activity Strip (**PR-4**; steer in PR-6)
- [x] Absorb workshop `ProcessChat` into the same dock (no dual chat panels) (**PR-5**)
- [x] Model dock / context meter / diagnostics / steer (**PR-6**)

**Do not:** Keep a permanent second chat UI next to workshop chat; inject settings API keys into page context; block 4.15 multi-tab with irrecoverable singletons.

---

### 4.18 Business Documents / knowledge layer — **DONE** (foundation)

**Goal:** Durable business knowledge as markdown documents (basics, customers, market, strategy, freeform). Users view/edit in a simple Documents studio; pinned docs inject into Hermes process chat and chatbar page context. Sibling to `PROCESS.md` — not a generic wiki.

**Status:** Foundation shipped.

**Reference:** [`docs/references/BUSINESS_DOCUMENTS.md`](BUSINESS_DOCUMENTS.md)

**Depends on:** Business model, business log, process chat prompts (4.2), global chatbar (4.17) for page context

**Shipped:**
- [x] `BusinessDocument` Prisma model + migration
- [x] Seeded kinds on new business (`ensureBusinessDocuments`) + lazy seed for existing
- [x] `/documents` list + markdown viewer / editor + import `.md`
- [x] CRUD + import APIs under `/api/documents`
- [x] Business log events: `document.created` / `document.updated` / `document.deleted`
- [x] Git materialize: `documents/{slug}.md` + `documents/index.json`
- [x] Pinned docs (+ Basics) injected into process chat system prompt
- [x] Chatbar page blurb + server snapshot for `/documents`

**Remaining (optional):**
- [ ] Hermes propose/apply document patches via tool/API from chatbar
- [ ] Sync Basics headings → `Business.goals` / description fields
- [ ] Extract short `Memory` facts from documents

**Do not:** Build a full Notion/wiki (folders, collab, binary office formats) in this item.

---

## Phase 5 — Map → Monitor → Automate (M0 operating loop)

Product spine for solo founders: **Map** (understand) → **Monitor** (instrument) → **Automate** (Hermes agents + crons).  
M0 is **Hermes-only inside Forge** (no Notion required; n8n secondary until M1).

**IA evolution (Phase 6):** treat Map / Monitor / Automate as **rooms of the Forge** (not equal peer “stages” always fully open). Foundation is a first-class room; soft-lock Monitor/Automate until ≥1 **forged** process; Map’s primary surface becomes the plant PFD. Canonical model: [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md). Phase 5 surfaces (content, metrics, automations) stay; chrome and unlock change under 6.6 / 6.7.

### 5.0 Stage explorer + stage-scoped nav — **DONE** (foundation)

**Goal:** Top-bar stage control (Map | Monitor | Automate) filters the left rail.

**Shipped:**
- [x] `lib/forge-stage.ts` — stage types, storage, route→stage inference
- [x] `StageProvider` + `StageExplorer` in app top bar
- [x] Nav rail filtered by stage; deep links auto-select stage
- [x] Default landing routes per stage (Functions / Metrics / Automations)

### 5.1 Content inventory — **DONE** (foundation)

**Goal:** Operational content pieces separate from knowledge Documents.

**Shipped:**
- [x] `ContentItem` Prisma model + migration
- [x] `/api/content` CRUD + health counts
- [x] `/content` studio UI (status pipeline, channels)
- [x] Business log events `content.*`
- [x] Nav under Monitor + Automate stages

### 5.2 Monitor metrics + content health — **DONE** (foundation)

**Goal:** Instrument what matters before/while automating.

**Shipped:**
- [x] `BusinessMetric` + `MetricSample` models
- [x] `/api/metrics` list/create + sample record/delete
- [x] `/metrics` page: content health board + manual channel metrics
- [x] Business log events `metric.*`

**Remaining:** Hermes scheduled metric collectors; failure alerts productization.

### 5.3 Automate: agent assign + Hermes cron (content-aware) — **MOSTLY DONE**

**Already shipped (4.10 / 4.4):** hired agent bind on Automation, DeployPanel agent picker, Hermes cron deploy.

**M0 polish:**
- [x] Default deploy path Hermes cron (n8n labeled advanced)
- [x] Cron prompts mention Forge Content inventory for drafts
- [x] Auto-create Content via `POST /api/content/ingest` (Automation.ingestToken) + simulate handoff UI
- [x] In-app notification (`content_review`) when agent drafts need review
- [ ] Pause/resume UX + owner-facing run health (beyond Cronalytics)

### 5.4 Content Ops template — **DONE**

- [x] `templates/workflows/content-ops.json` + catalog entry (first card on home)

### 5.5 n8n as Automate expansion — **Pending** (M1)

Productize n8n as optional multi-app runtime under Automate / Integrations. Code exists (4.4); UI prioritizes Hermes first.

### 5.6 External connectors (Notion, etc.) — **Pending** (M2)

Optional systems of record after Hermes-only loop is proven.

---

## Phase 6 — Business as plant: Foundation → shapes → process network

**Canonical reference:** [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) (rooms, soft unlock, Underlord, Map plant, entry rules).

**North-star metaphor (chemical engineering / plant design):**  
A business is a **designed plant**. The whole plant is one process system with many unit operations (mapped processes), multiple feeds (inputs), and finished products / outcomes (outputs). Hermes Forge’s long-horizon deliverable is a **process flow diagram (PFD) of the business** — not only deep maps of isolated unit ops, but the **overall plant topology** generated as the user talks.

**Product shift:**  
Phase 2 jumps Home composer → Workshop for a single process. That is right for *depth*, wrong as the *default first room* for a new business. New businesses land in **Foundation** (agent persona **Underlord**); Map opens as the working plant; Workshop is a **tool inside Map**; Monitor / Automate **soft-unlock** after ≥1 **forged** process. Home dissolves into Foundation for new businesses.

**Relationship to existing surfaces:**

| Surface | Role in Phase 6 |
|---------|-----------------|
| **Foundation room** | Default entry for new / thin businesses; chat-first plant sketch; agent **Underlord** |
| **Map room** | Working plant PFD (promoted God Mode compact + links); primary overview |
| **Monitor / Automate rooms** | Soft-locked until ≥1 forged process; operating loop unchanged once open |
| **Documents** | Business knowledge appears as agent populates |
| **Workshop** | **Not a room** — forge bench tool inside Map (full Mermaid + chat) |
| **Functions** | Secondary Map view (org bands / list), not Map primary long-term |
| **God Mode** | **Promoted into Map** as primary plant canvas (exit pure dev-gate for product) |
| **Global chatbar** | Drives Foundation population (documents + draft processes) with page context |

**Design principles for this phase:**
1. **Low fidelity first, high fidelity on demand** — shapes and drafts before full diagrams.
2. **I/O shape = external black-box interface**, not internal flowchart branching.
3. **Derive and recompute** shape as the process grows; default `siso` on create.
4. **Progressive chrome / soft room unlock** — rooms visible; Monitor/Automate gated on forged; empty shells stay out of the way.
5. **Plant PFD is the milestone** — process-to-process links + Map as plant, not a side experiment.
6. **Rooms of the Forge** — place metaphor over stage pipeline; see reference doc.

**Next implementation priority:** **6.6** + **6.7** (wow). Defer 4.5 integrations, 4.16 code signing, 5.5/5.6 connectors.

---

### 6.0 Phase vision & reference — **DONE** (docs)

**Goal:** Capture the plant/PFD product thesis so agents and humans share one end state before code.

**Deliverables:**
- [x] Dedicated reference [`docs/references/BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) — metaphor, **rooms**, soft unlock, shape/link model, Underlord, non-goals, decision log
- [x] Update [`docs/references/INDEX.md`](INDEX.md)
- [x] Concept flow: Foundation (Underlord) → Map plant → Workshop tool → forge → Monitor/Automate soft-unlock
- [x] Locked decisions (2026-07-16): forged gate, soft locks, Workshop-in-Map, Home→Foundation for new business, God Mode→Map, room-specific homepages deferred

**Status:** Reference is source of truth for room IA. Implement under **6.6** / **6.7**.

**Do not:** Rewrite Phase 2 as deprecated — Workshop deep-map stays; Foundation is the *entry* path; Workshop is Map’s tool.

---

### 6.1 Process I/O shape library — **DONE** (foundation)

**Goal:** Every process has a simple **I/O shape** (black-box topology) used for overview UI, agent language, and later plant layout.

**Closed library (v1):**

| ID | Name | Glyph idea | Meaning |
|----|------|------------|---------|
| `siso` | Single in, single out | `→ □ →` | Linear unit / pipeline step |
| `simo` | Single in, multi out | `→ □ ⇉` | Split / fan-out / distribute |
| `miso` | Multi in, single out | `⇉ □ →` | Merge / assemble / consolidate |
| `mimo` | Multi in, multi out | `⇉ □ ⇉` | Hub / exchange / multi-feed multi-product |

**Data model:**
- `Process.ioShape` — string, default `"siso"` (`lib/io-shape.ts`)
- Prefer name **`ioShape`** / UI **“Shape”** over overloaded “process type”
- Optional later: `ioShapeOverride` if manual pin is needed; primary path is **recompute on change**

**Shipped:**
- [x] Schema + Prisma migration + types (`lib/types.ts`, APIs, PROCESS.md list line)
- [x] Auto-assign on process create (default `siso`; derive from inputs/outputs/diagram when present)
- [x] Recompute on process PATCH (I/O / diagram / explicit shape), diagram subagent, split, decision execute
- [x] Counting rule: **process-boundary** inputs/outputs only — free-text lists first, else Mermaid sources/sinks (not internal branch fan-out when paths merge)
- [x] SVG glyphs + badge (`components/process/IoShapeGlyph.tsx`); Details panel + process sidebar
- [x] Hermes prompt addon + PROCESS.md I/O shapes section
- [x] Unit tests (`tests/unit/io-shape.test.ts`)

**Depends on:** Process model, workshop diagram updates (3.1)

**Do not:** Expand the library with generator/sink/cycle variants in v1 unless a clear gap appears.

---

### 6.2 Foundation room (business staging) — **DONE** (foundation)

**Goal:** New default room for a business that is not “jump straight to Workshop.” User talks about the business; Hermes populates foundations (documents + draft process blocks). User later enters Workshop on a chosen process to refine.

**Working name:** **Foundation** (room). Foundation agent persona: **Underlord** (6.0 / 6.7 copy).

**Shipped:**
- [x] Route `/foundation` + Map-stage nav (`foundation` in `STAGE_NAV_IDS`) + Map stage default landing
- [x] Foundation room: progressive sidebar (business, documents when present, process list) + plant canvas of I/O-shape cards
- [x] `GET /api/foundation` overview + `POST /api/foundation/seed-drafts` (idempotent by name)
- [x] Add draft dialog; **Open in Workshop** sets active process and navigates
- [x] Shell chatbar only — page blurb, server snapshot, studio prompt addon for Foundation
- [x] Entry: home brief → Foundation; post-hire → Foundation (hire gate still first for new business)
- [x] Unit tests: `tests/unit/foundation.test.ts` + stage/page-registry coverage

**Partial / deferred:**
- [ ] Underlord persona in Foundation chat context (6.6/6.7)
- [ ] Hermes tool-calls that auto-write documents + seed drafts mid-chat (today: propose in chat; user Add draft or seed API)
- [ ] Thin-business auto-redirect when switching businesses (6.7); Home dissolves into Foundation for new businesses
- [ ] Foundation as first-class room in room switcher (not only a Map-stage nav item) — 6.6

**Depends on:** 4.17 chatbar, 4.18 documents, 6.1 shapes

**Do not:** Duplicate a second permanent chat UI next to the shell chatbar; rebuild Documents or Workshop from scratch.

---

### 6.3 Draft process seeding from conversation — **DONE** (foundation)

**Goal:** Reliable, reviewable pipeline from Foundation chat → many lightweight process stubs.

**Shipped:**
- [x] Structured extraction: `lib/foundation-extract.ts` — parse ```forge-drafts``` fences; optional Hermes extract via `POST /api/foundation/extract-drafts`
- [x] Idempotent seed/upsert: `lib/foundation-seed.ts` + seed-drafts `mode: skip | upsert` (upsert only non-forged)
- [x] Business log: `process.created` on seed; `process.updated` on upsert (shape/description)
- [x] Review UI: `DraftReviewPanel` — rename, deselect, discard rows, then seed selected
- [x] Chatbar handoff: on Foundation, assistant fence → toast + review panel; **Seed from chat** re-extracts studio thread
- [x] Rename / delete draft stubs on Foundation canvas (forged locked)
- [x] Status stays `draft` on seed/upsert until workshop refine / forge
- [x] Unit tests: `tests/unit/foundation-extract.test.ts`

**Depends on:** 6.2 Foundation room, process APIs, business log (4.11)

**Do not:** Auto-generate large Mermaid for every stub on first mention — shapes first, diagrams on refine.

---

### 6.4 God Mode → compact plant canvas — **DONE** (foundation)

**Goal:** Replace (or toggle away from) full-Mermaid tiles with **uniform I/O-shape cards** so the whole business is scannable on one pan/zoom canvas.

**Shipped:**
- [x] Compact tile: name, status, shape glyph (fixed size via `COMPACT_TILE`)
- [x] Toggle: **Compact** | **Diagrams** (persisted `forge:god-mode-view`; default compact)
- [x] Fit-to-view / pan / zoom still apply to both modes
- [x] Click compact card → Workshop (active process set)
- [x] Empty states link Foundation when no processes; “Show compact shapes” when diagrams empty
- [x] `lib/god-mode-view.ts` + unit smoke test

**Deferred:** free-drag positions / persist layout (6.5–6.6)

**Depends on:** 4.13 God Mode, 6.1 shapes

**Note:** Still department-grouped is OK for v1; true flow layout waits for links (6.5).

---

### 6.5 Process-to-process links (plant edges) — **DONE** (foundation)

**Goal:** First-class **connections between processes** so the plant has a flow network, not only a pile of boxes.

**Data model:**
- `ProcessLink`: `fromProcessId`, `toProcessId`, optional `label`, `fromPort` / `toPort`, `businessId`
- Unique directed edge per business; cascade delete with process/business

**Shipped:**
- [x] Schema + migration + API (`GET/POST /api/process-links`, `PATCH/DELETE /api/process-links/[id]`)
- [x] Business log: `process_link.created|updated|deleted`
- [x] Validation: same business, no self-links, no silent cross-business edges
- [x] Link mode on **Foundation** + **God Mode compact**: click source → target; click edge + Delete link
- [x] SVG edges via `PlantEdges` + shared `plant-layout`
- [x] PROCESS.md **Plant links** section + Git `process-links.json` materialize
- [x] Chatbar prompt/snapshot hints for handoffs
- [x] Unit tests: `process-links.test.ts`

**Partial:** Hermes does not yet auto-create links via tool-calls (proposes verbally; user draws). Ports unused in UI.

**Depends on:** 6.1, 6.2, 6.4

**End-state UX:** “Here is how work moves through the business” — the PFD, not only the unit-op SOPs.

---

### 6.6 Business plant PFD (end-state milestone) — **PLANNED** (priority)

**Goal:** Map room becomes a true **business process flow diagram**: shapes + edges + layout that reads like a plant drawing of the company. Room model + soft unlock land here with the plant surface.

**Reference:** [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) §§ 2, 4, 7, 10.

**First-wow deliverables (implement first):**
- [ ] **Room IA:** stage explorer → room switcher (Foundation | Map | Monitor | Automate); user-facing “room” copy
- [ ] **Soft locks:** Monitor + Automate gated on ≥1 `lifecycleStatus === "forged"`; Map empty state when no processes; no hard 404s
- [ ] **Promote God Mode plant into Map** as primary Map surface (exit pure dev-gate for product plant canvas)
- [ ] Workshop treated as **Map tool** (drill-in from plant; not a peer room in the switcher)
- [ ] Zoom from plant → unit op (Workshop) without losing business context
- [ ] Unlock / empty-state copy + Foundation **Underlord** persona wiring in chat context

**Trail deliverables (same milestone, can follow first wow):**
- [ ] Layout modes: by function (department bands) | by flow (graph layout) | manual positions
- [ ] External plant feeds/products (business-level inputs/outputs) optional framing
- [ ] Export plant view (PNG/SVG/PDF) as a first-class deliverable alongside per-process export (3.8)

**Depends on:** 6.0–6.5

**Success criteria (product):**
- A user describing their business in Foundation ends with a **visible plant of draft blocks**
- Opening any block yields a workshop path to a **realistic process map**
- Linked processes show **end-to-end flow** (e.g. lead → delivery → support) on one canvas
- Forging one process soft-unlocks Monitor + Automate
- The metaphor holds: **business = plant; process = unit operation; link = stream**

**Do not:** Require chemical-engineering literacy in UI copy — keep labels plain (“Shape”, “Flow”, “Connected processes”); metaphor is design guidance, not user jargon. Do not hard-lock routes.

---

### 6.7 Entry-flow migration (Home → Foundation) — **PLANNED** (priority)

**Goal:** Align acquisition UX with Phase 6 rooms without stranding existing workshop-first habits. **Home dissolves into Foundation** for new businesses.

**Reference:** [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) § 6.

**Deliverables:**
- [ ] Home composer / new business → **Foundation** (default); no product Home lobby as first room for thin businesses
- [ ] Template starters seed Foundation drafts (and optional first workshop deep-link)
- [ ] “Continue mapping” deep links still open Workshop on `activeProcessId` when refining
- [ ] Empty/thin business heuristic: Foundation; mature business: **Map** or last room
- [ ] Underlord + Foundation onboarding copy
- [ ] Docs / agent references already point here; keep in sync if entry routes change

**Deferred (explicit):** unique homepage per room (Map / Monitor / Automate homes) — design later; do not block this item.

**Depends on:** 6.2, 6.0

**Do not:** Break desktop multi-tab session restore (4.15) or business isolation.

---

## Item index (quick reference)

| ID | Title | Phase | Status |
|----|-------|-------|--------|
| 1.1 | Token-based theme | 1 | Done |
| 1.2 | Left icon rail | 1 | Done |
| 1.3 | Hero home + composer | 1 | Done |
| 1.4 | Recent projects strip | 1 | Done |
| 1.5 | Template starter cards | 1 | Done |
| 2.1 | Send → project + workshop | 2 | Done |
| 2.2 | Process standards picker | 2 | Done |
| 2.3 | Inline model switcher | 2 | Done |
| 2.4 | Function status lifecycle badges | 2 | Deferred |
| 3.1 | Streaming diagram | 3 | Done |
| 3.2 | Node comments | 3 | Done |
| 3.3 | Questions panel | 3 | Done |
| 3.4 | Conversation fork | 3 | **Done** |
| 3.5 | Rich composer | 3 | Mostly done (`@system` done; `/export` args optional) |
| 3.6 | Workspace tabs | 3 | Done |
| 3.7 | Queued messages | 3 | Done |
| 3.8 | Export handoff | 3 | **Done** (client PNG/PDF) |
| 3.9 | Diagram multi-flow split | 3 | **Done** (foundation) |
| 4.1 | Template library | 4 | **Done** (JSON files) |
| 4.2 | PROCESS.md | 4 | **Done** (foundation) |
| 4.3 | Template marketplace | 4 | Pending |
| 4.4 | Automations page | 4 | Done |
| 4.5 | Integrations page | 4 | Pending |
| 4.6 | Hermes Desktop skin engine | 4 | Done |
| 4.7 | User theme install (JSON) | 4 | Done |
| 4.8 | VS Code theme import (Electron) | 4 | Done |
| 4.9 | UI primitive convergence | 4 | Done |
| 4.10 | Personnel roster | 4 | **Done** (workshop + automation bind + systems mentions via 3.5) |
| 4.11 | Immutable business log | 4 | **Mostly done** (push + import; decision.* events shipped) |
| 4.12 | Business decisions / HITL | 4 | **Done** |
| 4.13 | God Mode overview | 4 | Done (dev-gated) |
| 4.14 | Cronalytics | 4 | Done (dev-gated) |
| 4.15 | Desktop multi-tab shell | 4 | **Done** (Phase 1–3) — see [`DESKTOP_MULTI_TAB_SHELL.md`](DESKTOP_MULTI_TAB_SHELL.md) |
| 4.16 | Windows installer code signing | 4 | **Planned** — see [`WINDOWS_CODE_SIGNING.md`](WINDOWS_CODE_SIGNING.md) |
| 4.17 | Global chatbar (shell Hermes co-pilot) | 4 | **Done** (PR-1–6) — see [`GLOBAL_CHATBAR.md`](GLOBAL_CHATBAR.md) |
| 4.18 | Business Documents / knowledge layer | 4 | **Done** (foundation) — see [`BUSINESS_DOCUMENTS.md`](BUSINESS_DOCUMENTS.md) |
| 5.0 | Stage explorer + stage-scoped nav | 5 | **Done** (foundation) |
| 5.1 | Content inventory | 5 | **Done** (foundation) |
| 5.2 | Monitor metrics + content health | 5 | **Done** (foundation) |
| 5.3 | Automate agent + content-aware cron | 5 | **Mostly done** |
| 5.4 | Content Ops template | 5 | **Done** |
| 5.5 | n8n Automate expansion | 5 | Pending (M1) |
| 5.6 | Notion / external connectors | 5 | Pending (M2) |
| 6.0 | Phase vision & plant/PFD reference | 6 | **Done** — [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) |
| 6.1 | Process I/O shape library | 6 | **Done** (foundation) |
| 6.2 | Foundation room (business staging) | 6 | **Done** (foundation) |
| 6.3 | Draft process seeding from conversation | 6 | **Done** (foundation) |
| 6.4 | God Mode compact plant canvas | 6 | **Done** (foundation) |
| 6.5 | Process-to-process links (plant edges) | 6 | **Done** (foundation) |
| 6.6 | Business plant PFD + room IA / soft unlock | 6 | **Planned** (priority — first wow) |
| 6.7 | Entry-flow migration (Home → Foundation) | 6 | **Planned** (priority) |

---

## Audit remediation (2026-07-07)

Source: [`audit.md`](audit.md). Full findings and redundancy list live there; this table tracks cleanup execution.

| ID | Task | Status |
|----|------|--------|
| AUDIT-1 | Align `PRODUCT_BACKLOG.md` baseline with codebase | **Done** |
| AUDIT-2 | Personnel honesty pass (copy, placeholders, dead components) | **Done** |
| AUDIT-3 | Remove legacy Interview (`/interview`, `/api/extract`) | **Done** |
| AUDIT-4 | Merge Dashboard into Functions (org chart + analytics) | **Done** |
| AUDIT-5 | Dev-gate God Mode in nav + route guard | **Done** |
| AUDIT-6 | Dead code cleanup (accent, duplicate next.config, theme exports, dead CSS) | **Mostly done** — accent.ts removed, next.config.mjs removed, accent-swatch CSS removed; residual theme export pruning optional |
| AUDIT-7 | Schema honesty (`BusinessDecision`, `PERSONNEL_REMOVED`, personnel git import) | **Done** — Decisions HITL API + UI + `decision.*` events; unused `PERSONNEL_REMOVED` removed; personnel git import |
| AUDIT-8 | Repo hygiene (gitignore WAL, API smoke tests) | **Mostly done** — WAL gitignored; `npm test` unit suite (17 tests) |
| AUDIT-9 | Terminology pass ("project" → "business" in UI) | **Done** — NewBusinessDialog, shell context, auth copy, process-card CSS |
| AUDIT-10 | Personnel workshop integration (mentions, swimlanes, automation) | **Done** — mentions + prompts + swimlane lanes; personnel git import + automation agent bind; `@system` mentions via 3.5 |

**Session outcomes (code):**
- `docs/references/audit.md` committed as canonical audit
- `components/functions/FunctionOrgChart.tsx`, `BusinessAnalyticsSection.tsx` — merged Functions page
- Redirects: `/interview` → `/home`, `/dashboard` → `/functions`
- Developer setting: `forge:dev-show-god-mode` (`lib/developer-settings.ts`)

---

## Agent handoff notes

When picking up a backlog item:

1. Read this file and check **Depends on** for the item.
2. Update the **Status** column when starting (`In progress`) and finishing (`Done`).
3. Follow existing code style in `app/` and `components/`; match token classes from 1.1 once merged.
4. Run `npm run build` before marking done.
5. Do not expand scope into later phases unless the item explicitly requires it.
6. Open Design source is reference only — do not copy their codebase; adapt patterns to process mapping.

**Completed outside backlog (tracked above as 4.10–4.14):**
- Functions view (`/functions`) replacing `/projects`
- Business manager (`/business-manager`) for multi-business switching
- New business modal (`NewProjectDialog` — legacy "project" naming)
- Business isolation (`lib/workshop-storage.ts`, `requireProcessAccess` active-business guard)
- Settings: System / Light / Dark mode + skin picker (`components/settings/SettingsMenu.tsx`, `SkinPicker.tsx`, `lib/themes/`)
- Process approval + automation studio + n8n integration (4.4)
- Personnel roster + workshop wiring + automation agent bind (4.10); `@system` mentions (3.5)
- Business log + git materialize (4.11); decision.* events via 4.12
- God Mode canvas (4.13)
- Cronalytics dev tooling (4.14)

**Removed / merged:**
- `/interview` + `/api/extract` — legacy discovery; `/interview` redirects to `/home`
- `/dashboard` — merged into `/functions` (analytics section below org chart)

**Known tech debt:** See [`audit.md`](audit.md) and **AUDIT-6 … AUDIT-10** above. Highlights:
- No HTTP/SSE integration tests yet (unit smoke via `npm test` only)
- Optional theme export pruning (AUDIT-6 residual)
- Optional 4.12: supersede/revoke UI; freeform policy decisions

**Phase 6:**
- Canonical IA: [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) — rooms, soft unlock on **forged**, Underlord, Workshop-in-Map, God Mode→Map
- **Next:** implement **6.6** + **6.7** (priority wow). Foundations 6.1–6.5 shipped; **6.0** docs done
- Defer for this push: integrations (4.5), code signing (4.16), n8n/connectors (5.5/5.6), per-room homepages
