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

**Legacy aliases still in UI copy:** "project" (`RecentProjectsStrip`, `NewProjectDialog`) — means `Business`, not a separate entity. `/projects` redirects to `/functions`.

**Redirects:** `/interview` → `/home`; `/dashboard` → `/functions` (dashboard merged into Functions page).

---

## Current codebase (baseline)

*Last aligned with codebase: v0.2.0 + post-release WIP (personnel, themes). Audit remediation session: 2026-07-07 — see [Audit remediation](#audit-remediation-2026-07-07).*

### Shell & navigation

| Area | Path | Notes |
|------|------|-------|
| App shell | `app/(shell)/layout.tsx`, `components/shell/AppShell.tsx` | Left nav rail + content area |
| Nav rail | `components/shell/NavRail.tsx` | Home, Functions, Personnel, Workshop, Automations, Business log (+ dev-gated God Mode, Decisions, Cronalytics) |
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
| New business modal | `components/projects/NewProjectDialog.tsx` | Name + description (legacy "project" naming) |
| Hermes connection | `components/hermes/*`, `app/api/hermes/**` | BYOK OpenAI-compatible proxy |
| Client state | `lib/workshop-storage.ts` | Per-business `activeProcessId`, conversation, function filter |

### Automations & governance

| Area | Path | Notes |
|------|------|-------|
| Automations list | `app/(shell)/automations/page.tsx` | Approved processes → automation studio |
| Automation studio | `app/(shell)/automations/[processId]/page.tsx` | Design chat, n8n deploy, credentials |
| Business log | `app/(shell)/log/page.tsx`, `lib/business-log.ts` | Append-only immutable event feed |
| Git materialize | `lib/business-git/materialize.ts` | Per-business repo snapshot (export; remote sync partial) |
| Decisions | `app/(shell)/decisions/page.tsx` | **Scaffold** — dev-gated placeholder; `BusinessDecision` model has no API |
| God Mode | `app/(shell)/god-mode/page.tsx` | **Dev-gated** — diagram canvas overview by department |
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
- Workshop → `/workshop`
- Automations → `/automations`
- Business log → `/log`
- God Mode → `/god-mode` (developer setting)
- Decisions → `/decisions` (developer setting)
- Cronalytics → `/cronalytics` (developer setting)
- Footer: Theme mode toggle, Hermes connection, Profile

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

### 3.4 Conversation fork / multiple threads — **MOSTLY DONE**

**Goal:** Fork process mapping from any chat turn; multiple conversations per project.

**Files:** `prisma/schema.prisma` (`Conversation`), `app/api/processes/[id]/conversations/route.ts`, `components/workshop/ConversationsMenu.tsx`, `lib/workshop-storage.ts`

**Shipped:** Conversation model; fork API; conversation switcher in chat header; per-process active conversation persistence; chat/diagram filtered by `conversationId`.

**Remaining:**
- [ ] Fork-from-specific-message UI (`forkAtMessageId` exists in API, not wired in chat)
- [ ] Delete / rename conversation
- [x] Export tab uses active conversation messages when forks exist

---

### 3.5 Rich composer (mentions + slash commands) — **MOSTLY DONE**

**Goal:** `@department`, `@system` mentions; `/add-step`, `/export` slash commands.

**Files:** `components/workshop/rich-composer/*`, `ProcessChat.tsx`

**Shipped:** `RichComposer` with `@` autocomplete (diagram step nodes), slash commands (`/help`, `/name`, `/add-step`, `/simplify`, `/export`, `/accuracy`), suggestion popover, node context pill.

**Remaining:**
- [ ] `@department` / `@system` / actor mentionables (beyond diagram nodes)
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

### 3.8 Export handoff — **PARTIAL**

**Goal:** Export Mermaid, PNG, PDF, Markdown SOP; optional "Open in Cursor" context bundle.

**Files:** `components/export/ExportMenu.tsx` (Export workspace tab)

**Shipped:** Markdown SOP, Mermaid source, Cursor JSON bundle; copy/download; "Open in Cursor" prompt; `/export` slash command opens Export tab.

**Remaining:**
- [ ] PNG / PDF export
- [ ] `app/api/processes/[id]/export/route.ts` (server-side render pipeline)
- [x] Scope export to active conversation when forks exist

---

## Phase 4 — Extensibility

### 4.1 Workflow template library

**Goal:** Curated templates as repo files (`templates/workflows/*.json`).

---

### 4.2 PROCESS.md contract

**Goal:** Per-project `PROCESS.md` schema: notation, actors, systems, automation goals.

**Schema sections:** Overview, Actors, Systems, Notation, Anti-patterns, Export format

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

### 4.10 Personnel roster — **SCAFFOLD** (shipped outside backlog)

**Goal:** Org roster for humans and hired Hermes agents; feed swimlanes, `@actor` mentions, and automation assignment.

**Status:** UI, API, and DB exist. **Not integrated** with workshop, process diagrams, automations, or chat agent prompts. Page + hire dialog copy state roster-only scope (honesty pass shipped).

**Files:** `app/(shell)/personnel/page.tsx`, `app/api/personnel/**`, `components/personnel/*`, `lib/personnel/*`, `prisma/schema.prisma` (`HumanPersonnel`, `HermesAgentProfile`)

**Shipped (scaffold):**
- [x] Personnel nav + page: human add/fire, icon picker
- [x] Owner bootstrap on business create/import/seed (`lib/personnel/ensure-owner.ts`)
- [x] Hermes agent filesystem scan, hire/fire, icon on profile
- [x] Business log events: `personnel.added`, `personnel.hired`, `personnel.fired`
- [x] Git export writes `personnel.json` (`lib/business-git/materialize.ts`)

**Remaining (required before marking Done):**
- [ ] Wire roster into workshop `@` mentions (`@actor`, `@department`, `@system` — overlaps 3.5)
- [ ] Swimlane lanes generated from personnel when process standard = swimlane
- [ ] `Automation` → `hermesAgentProfileId` (or equivalent) for hired agents
- [ ] Inject personnel context into chat + diagram agent prompts
- [ ] Human edit PATCH (name, role, `roleDescription`); display description on cards
- [ ] Import `personnel.json` on business git import
- [x] Align hire dialog + page copy with actual behavior (honesty pass)

**Do not:** Treat personnel as complete for BPM workflows until process linkage ships.

---

### 4.11 Immutable business log — **MOSTLY DONE** (shipped outside backlog)

**Goal:** Append-only audit trail per business; foundation for Git versioning and governance.

**Files:** `lib/business-log.ts`, `lib/business-log-types.ts`, `app/(shell)/log/page.tsx`, `app/api/business/log/route.ts`, `lib/business-git/*`

**Shipped:**
- [x] `BusinessEvent` model with sequence, hashes, metadata
- [x] Log feed UI with type filters (`components/log/BusinessLogFeed.tsx`)
- [x] Events emitted across business/process/automation/personnel actions
- [x] Git materialize exports log + snapshot files per business

**Remaining:**
- [ ] Remote Git sync (fields on `Business` are stubbed "inert until implemented")
- [ ] Round-trip import from git snapshot (personnel, decisions, etc.)
- [ ] Emit `decision.*` events when Decisions feature ships (4.12)

**Reference:** `docs/references/BUSINESS_LOG_AND_GIT.md`

---

### 4.12 Business decisions — **SCAFFOLD** (shipped outside backlog)

**Goal:** Record owner decisions linked to business log and related entities (process, personnel, automation).

**Files:** `prisma/schema.prisma` (`BusinessDecision`), `lib/decision-types.ts`, `app/(shell)/decisions/page.tsx`

**Status:** Prisma model + event type constants exist. Page is developer-gated placeholder. **No CRUD API, no queries, no log emission.**

**Remaining:**
- [ ] Decisions API (create, list, supersede, revoke)
- [ ] UI: decision list, create form, link to related entity
- [ ] Emit `decision.recorded` / `decision.superseded` / `decision.revoked` on business log
- [ ] Or: remove schema until ready (avoid middle state)

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

### 4.15 Desktop multi-tab shell — **PLANNED**

**Goal:** Notion/open-design-style tab bar in the Electron desktop app so users can work on different businesses or aspects of a business **at the same time**, with background Hermes chat/diagram streams continuing in inactive tabs.

**Status:** Design complete; not implemented. Full architecture, phases, and checklist in the reference doc below.

**Reference:** [`docs/references/DESKTOP_MULTI_TAB_SHELL.md`](DESKTOP_MULTI_TAB_SHELL.md)

**Depends on:** 4.8 (desktop packaging), workshop (Phase 3), active business cookie model (today's baseline)

**Key deliverables:**
- [ ] `ForgeTabProvider` + `ForgeTabBar` (desktop-gated via `isForgeDesktop()`)
- [ ] `X-Forge-Business-Id` header + `forgeFetch` for per-tab API scoping
- [ ] `WorkshopSession` extraction + `ForgeTabOutlet` multi-mount for true parallel streams
- [ ] Tab-aware `NavRail`; tab persistence across app restart
- [ ] Phase 3 polish: keyboard shortcuts, open-in-new-tab, memory guard

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
| 3.4 | Conversation fork | 3 | Mostly done |
| 3.5 | Rich composer | 3 | Mostly done |
| 3.6 | Workspace tabs | 3 | Done |
| 3.7 | Queued messages | 3 | Done |
| 3.8 | Export handoff | 3 | Partial |
| 4.1 | Template library | 4 | Pending |
| 4.2 | PROCESS.md | 4 | Pending |
| 4.3 | Template marketplace | 4 | Pending |
| 4.4 | Automations page | 4 | Done |
| 4.5 | Integrations page | 4 | Pending |
| 4.6 | Hermes Desktop skin engine | 4 | Done |
| 4.7 | User theme install (JSON) | 4 | Done |
| 4.8 | VS Code theme import (Electron) | 4 | Done |
| 4.9 | UI primitive convergence | 4 | Done |
| 4.10 | Personnel roster | 4 | **Scaffold** |
| 4.11 | Immutable business log | 4 | Mostly done |
| 4.12 | Business decisions | 4 | **Scaffold** |
| 4.13 | God Mode overview | 4 | Done (dev-gated) |
| 4.14 | Cronalytics | 4 | Done (dev-gated) |
| 4.15 | Desktop multi-tab shell | 4 | **Planned** — see [`DESKTOP_MULTI_TAB_SHELL.md`](DESKTOP_MULTI_TAB_SHELL.md) |
| 4.16 | Windows installer code signing | 4 | **Planned** — see [`WINDOWS_CODE_SIGNING.md`](WINDOWS_CODE_SIGNING.md) |

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
| AUDIT-6 | Dead code cleanup (accent, duplicate next.config, theme exports, dead CSS) | **Partial** — personnel dead components removed |
| AUDIT-7 | Schema honesty (`BusinessDecision`, `PERSONNEL_REMOVED`, personnel git import) | Pending |
| AUDIT-8 | Repo hygiene (gitignore WAL, API smoke tests) | Pending |
| AUDIT-9 | Terminology pass ("project" → "business" in UI) | Pending |
| AUDIT-10 | Personnel workshop integration (mentions, swimlanes, automation) | Deferred — honesty pass shipped instead |

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
- Personnel roster scaffold (4.10) — **do not assume workshop integration**
- Business log + git materialize (4.11)
- God Mode canvas (4.13)
- Cronalytics dev tooling (4.14)

**Removed / merged:**
- `/interview` + `/api/extract` — legacy discovery; `/interview` redirects to `/home`
- `/dashboard` — merged into `/functions` (analytics section below org chart)

**Known tech debt:** See [`audit.md`](audit.md) and **AUDIT-6 … AUDIT-10** above. Highlights:
- Terminology drift: "project" in UI vs `Business` in DB (AUDIT-9)
- `BusinessDecision` schema without runtime (4.12 / AUDIT-7)
- Personnel not wired to workshop/automations (4.10 / AUDIT-10)
- Zero automated tests (AUDIT-8)
- Accent legacy, duplicate `next.config` (AUDIT-6)