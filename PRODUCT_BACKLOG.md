# Hermes Forge — Product Backlog

Implementation plan adapted from [Open Design](https://github.com/nexu-io/open-design) (nexu-io/open-design). Open Design is an agent-native design workspace: brief → scenario/template → streaming artifact → critique → deliver. Hermes Forge applies the same philosophy to **business process mapping** with Hermes Agent.

**Reference screenshot:** `Screenshot 2026-06-30 161549.png` (project root)  
**Open Design key paths:** `apps/web/src/styles/tokens.css`, `apps/web/src/components/HomeHero.tsx`, `apps/web/src/components/EntryNavRail.tsx`, `apps/web/src/components/EntryShell.tsx`, `apps/web/src/components/home-hero/chips.ts`

---

## Concept mapping

| Open Design | Hermes Forge equivalent |
|-------------|-------------------------|
| Design artifact (prototype, deck) | Process diagram + workflow map |
| `DESIGN.md` brand contract | Project brief / `PROCESS.md` standards |
| Skill / plugin scenario | Workflow template (onboarding, ops, sales, etc.) |
| Studio preview panel | Mermaid diagram (workshop center) |
| Chat with agent | Hermes process chat (workshop right) |
| Recent projects | Recent projects on home |
| Design system picker | Process notation / industry standards picker |

---

## Current codebase (baseline)

| Area | Path | Notes |
|------|------|-------|
| Projects list | `app/projects/page.tsx` | New Project modal; project cards |
| Workshop | `app/workshop/page.tsx` | 3-column: sidebar / diagram / chat |
| Process sidebar | `components/workshop/ProcessSidebar.tsx` | Workflow list |
| Process chat | `components/workshop/ProcessChat.tsx` | Hermes chat |
| Mermaid diagram | `components/workshop/MermaidDiagram.tsx` | Live diagram |
| New project modal | `components/projects/NewProjectDialog.tsx` | Name + description |
| Hermes connection | `components/hermes/*` | BYOK connection |
| Project isolation | `lib/workshop-storage.ts` | Per-project `activeProcessId` |
| Auth / API | `lib/auth.ts`, `app/api/**` | Cookie-scoped active business |
| Global styles | `app/globals.css`, `app/tokens.css` | Design tokens (Phase 1.1) |
| DB schema | `prisma/schema.prisma` | Business, Process, ChatMessage |

---

## Design principles (from Open Design — keep these)

1. **Agent-native, not agent-bundled** — Hermes is the engine; Forge is the studio shell.
2. **Local-first / BYOK** — User brings their own Hermes endpoint; no forced cloud.
3. **Project isolation** — Each project owns workflows, chats, and client state.
4. **Neutral chrome, rich artifact** — UI stays minimal; the diagram carries visual weight.
5. **Accent discipline** — Orange (`--accent`) for primary CTAs only; blue (`--selected`) for selected states; green for success/status.
6. **Discover → lock → stream → critique → deliver** — Interview → diagram → chat corrections → export.

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

**Do not:** Add light theme toggle yet (optional later). Do not change layout structure.

---

### 1.2 App shell with left icon rail — **DONE**

**Goal:** Persistent narrow left rail like Open Design `EntryNavRail.tsx`.

**Files:** `components/shell/AppShell.tsx`, `components/shell/NavRail.tsx`, `components/shell/ShellContext.tsx`, `components/shell/AppTopBar.tsx`, `app/(shell)/layout.tsx`

**Rail items (v1):**
- Logo (H) → `/home`
- **+** New project (opens modal)
- Home → `/home`
- Projects → `/projects`
- Workshop → `/workshop`
- Dashboard → `/dashboard`
- Footer: Appearance settings, Hermes connection, Profile

**Acceptance criteria:**
- [x] Rail visible on projects, workshop, dashboard, profile
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
- [x] Home vs Projects separated in nav rail (`/home` vs `/projects`)
- [x] Brief from home auto-sends first message in workshop

**Depends on:** 1.1, 1.2

---

### 1.4 Recent projects strip with status cards

**Goal:** Bottom section like Open Design `RecentProjectsStrip` + screenshot project cards.

**Files:** `components/home/RecentProjectsStrip.tsx`; extend `BusinessSummary` type / API if needed.

**Card fields:**
- Gradient/color thumbnail (hash from project name)
- Project name (truncated)
- Status pill: `Mapping` | `Needs input` | `Completed` | `Not started`
- Relative timestamp (`7m ago`)
- Workflow count

**Acceptance criteria:**
- [ ] Shows last 4 projects on home
- [ ] "View all ›" links to `/projects`
- [ ] Click card opens project in workshop

**Depends on:** 1.3, D2 (status lifecycle — can stub statuses initially)

---

### 1.5 Template starter cards

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
| `blank` | Blank process | Start from scratch | Empty process |

**Acceptance criteria:**
- [ ] Clicking card pre-fills composer or creates project+process with template metadata
- [ ] "...or start a blank project ›" link opens `NewProjectDialog`

**Depends on:** 1.3

---

## Phase 2 — Home → workshop flow

### 2.1 Send creates project + process + opens workshop

**Goal:** One action from home composer (like Open Design home Send).

**Files:** `app/api/businesses/route.ts`, `app/api/processes/route.ts`, `components/home/HomeHero.tsx`

**Flow:**
1. User types brief, optionally picks template
2. POST create business (name from brief or "Untitled Project")
3. POST create process with template seed prompt as first user message or assistant context
4. Set active business cookie
5. Navigate to `/workshop`

**Depends on:** 1.3, 1.5, B1

---

### 2.2 Process standards / notation picker

**Goal:** Footer control like Open Design "No design system" — "Process standard: None".

**Files:** `components/home/ProcessStandardPicker.tsx`, `lib/process-standards.ts`

**Options (v1):** None, BPMN-lite, Swimlane, Simple flowchart

**Depends on:** 1.3, G2 (PROCESS.md — can stub)

---

### 2.3 Inline Hermes model switcher in header

**Goal:** `InlineModelSwitcher` in top bar, not buried in dialog only.

**Files:** `components/hermes/HermesModelSwitcher.tsx`, update `HermesConnectionProvider`

**Depends on:** 1.2

---

### 2.4 Project status lifecycle badges

**Goal:** Consistent status pills across home cards and project list.

**Files:** `lib/project-status.ts`, update `prisma/schema.prisma` if persisting status

**Statuses:** `not_started` | `mapping` | `needs_input` | `review` | `completed`

**Derived rules (v1, no new DB field):**
- `not_started` — 0 processes
- `mapping` — has processes, latest updated < 24h
- `needs_input` — last message role is `assistant` asking question (heuristic)
- `completed` — user-marked or all processes have diagrams + confirmed names

**Depends on:** 1.4

---

## Phase 3 — Workshop depth

### 3.1 Streaming diagram updates

**Goal:** Partial Mermaid renders while Hermes generates (Open Design staged preview).

**Files:** `app/api/processes/[id]/diagram/route.ts`, `components/workshop/MermaidDiagram.tsx`

---

### 3.2 Node-level comments / corrections

**Goal:** Click Mermaid node → annotate → agent revises that step.

**Files:** `components/workshop/DiagramComments.tsx`, extend chat API

---

### 3.3 Discovery Questions panel

**Goal:** Offload discovery from chat to dedicated tab (Open Design `QuestionsPanel`).

**Files:** `components/workshop/QuestionsPanel.tsx`, workshop tab strip

**Questions:** Who triggers this? What systems? What's manual? What's the output?

---

### 3.4 Conversation fork / multiple threads

**Goal:** Fork process mapping from any chat turn; multiple conversations per project.

**Files:** DB schema (`Conversation` model), `components/workshop/ConversationsMenu.tsx`

---

### 3.5 Rich composer (mentions + slash commands)

**Goal:** `@department`, `@system` mentions; `/add-step`, `/export` slash commands.

**Files:** `components/workshop/RichComposer.tsx` (Lexical or lightweight)

---

### 3.6 Workspace tabs

**Goal:** Tab strip above diagram: Diagram | Details | Questions | Source | Export

**Files:** Refactor `app/workshop/page.tsx` → `FileWorkspace` pattern

---

### 3.7 Queued messages while agent runs

**Goal:** Queue clarifications during diagram/naming agent runs.

**Files:** `components/workshop/MessageQueue.tsx`

---

### 3.8 Export handoff

**Goal:** Export Mermaid, PNG, PDF, Markdown SOP; optional "Open in Cursor" context bundle.

**Files:** `app/api/processes/[id]/export/route.ts`, `components/workshop/ExportMenu.tsx`

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

### 4.4 Automations page

**Goal:** Repeatable process audits (Open Design `/automations`).

**Route:** `/automations`

---

### 4.5 Integrations page

**Goal:** MCP / external connectors for process discovery.

**Route:** `/integrations`

---

## Item index (quick reference)

| ID | Title | Phase | Status |
|----|-------|-------|--------|
| 1.1 | Token-based theme | 1 | Done |
| 1.2 | Left icon rail | 1 | Done |
| 1.3 | Hero home + composer | 1 | Pending |
| 1.4 | Recent projects strip | 1 | Pending |
| 1.5 | Template starter cards | 1 | Pending |
| 2.1 | Send → project + workshop | 2 | Pending |
| 2.2 | Process standards picker | 2 | Pending |
| 2.3 | Inline model switcher | 2 | Pending |
| 2.4 | Status lifecycle badges | 2 | Pending |
| 3.1 | Streaming diagram | 3 | Pending |
| 3.2 | Node comments | 3 | Pending |
| 3.3 | Questions panel | 3 | Pending |
| 3.4 | Conversation fork | 3 | Pending |
| 3.5 | Rich composer | 3 | Pending |
| 3.6 | Workspace tabs | 3 | Pending |
| 3.7 | Queued messages | 3 | Pending |
| 3.8 | Export handoff | 3 | Pending |
| 4.1 | Template library | 4 | Pending |
| 4.2 | PROCESS.md | 4 | Pending |
| 4.3 | Template marketplace | 4 | Pending |
| 4.4 | Automations page | 4 | Pending |
| 4.5 | Integrations page | 4 | Pending |

---

## Agent handoff notes

When picking up a backlog item:

1. Read this file and check **Depends on** for the item.
2. Update the **Status** column when starting (`In progress`) and finishing (`Done`).
3. Follow existing code style in `app/` and `components/`; match token classes from 1.1 once merged.
4. Run `npm run build` before marking done.
5. Do not expand scope into later phases unless the item explicitly requires it.
6. Open Design source is reference only — do not copy their codebase; adapt patterns to process mapping.

**Completed outside backlog (already shipped):**
- New Project modal (name + description)
- Project isolation (`lib/workshop-storage.ts`, `requireProcessAccess` active-business guard)
- Workshop header: H + Hermes Forge → `/projects`, project name underneath
- Settings popover on projects home (`components/settings/SettingsMenu.tsx`) with System / Light / Dark theme (`components/theme/ThemeProvider.tsx`, `lib/theme.ts`)