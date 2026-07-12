# Hermes Forge — Project Audit

**Version audited:** v0.2.0 (+ post-release WIP)  
**Audit date:** 2026-07-07  
**Remediation session:** 2026-07-07 (see [Remediation progress](#remediation-progress) below)

This document is the canonical repo health audit. It complements [`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md) (what to build) with an honest picture of mistakes, gaps, redundancy, and cleanup work.

---

## Remediation progress

Tracked in backlog as **AUDIT-1 … AUDIT-10** ([`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md#audit-remediation-2026-07-07)).

| ID | Task | Status | Notes |
|----|------|--------|-------|
| AUDIT-1 | Align `PRODUCT_BACKLOG.md` baseline with codebase | **Done** | Terminology section, 4.10–4.14, redirects, nav |
| AUDIT-2 | Personnel honesty pass | **Done** | Hire dialog + page copy; `[FIRE]` placeholders; `PersonnelIcon` removed; scaffold banner |
| AUDIT-3 | Remove legacy Interview flow | **Done** | Deleted `app/interview/page.tsx`, `app/api/extract/route.ts`; `/interview` → `/home` |
| AUDIT-4 | Merge Dashboard into Functions | **Done** | Org chart + analytics on `/functions`; dashboard page deleted; `/dashboard` → `/functions` |
| AUDIT-5 | Dev-gate God Mode | **Done** | Nav hidden by default; Settings → Developer toggle; route guard |
| AUDIT-6 | Dead code cleanup | **Mostly done** | accent.ts removed; next.config.mjs removed; accent-swatch CSS removed; optional theme export prune remains |
| AUDIT-7 | Schema honesty | **Partial** | Removed unused `PERSONNEL_REMOVED`; Decisions page + types state scaffold clearly; `BusinessDecision` still schema-only (no CRUD); personnel git import **done** (4.11) |
| AUDIT-8 | Repo hygiene | **Mostly done** | WAL gitignored; `npm test` unit smoke suite (17 tests via node:test); HTTP API smoke still optional |
| AUDIT-9 | Terminology pass | **Done** | `NewBusinessDialog`, shell `openNewBusiness`, auth copy, `process-card` / `recent-processes` CSS |
| AUDIT-10 | Personnel workshop integration | **Mostly done** | @-mentions + chat/diagram prompts + swimlane lanes; human edit PATCH shipped; personnel git import done; automation bind still open |

---

## What you've actually built

Hermes Forge is a **v0.2.0 agent-native process-mapping studio** with a strong core loop and substantial peripheral surface area.

```mermaid
flowchart LR
  Home["Home + brief"] --> Workshop["Workshop"]
  Workshop --> Diagram["Mermaid diagram"]
  Workshop --> Chat["Process chat"]
  Workshop --> Tabs["Details / Questions / Export"]
  Workshop --> Approve["Process approval"]
  Approve --> Auto["Automation studio + n8n"]
  Functions["Functions org chart"] --> Workshop
  Personnel["Personnel roster"] -->|"mentions + prompts"| Workshop
  Log["Business log"] --> GitExport["Git materialize"]
  Themes["Skin engine"] --> UI["All UI surfaces"]
```

**Solid and shippable:**
- Home → brief → workshop flow (`app/api/start-from-brief/route.ts`, `components/home/HomeHero.tsx`)
- 2-column workshop + global chatbar (PR-5 absorption): streaming diagrams, node comments, discovery questions, conversation forks, message queue, rich composer (`app/(shell)/workshop/page.tsx`)
- Automations pipeline (approval → studio → n8n deploy) — backlog 4.4
- Business log + append-only events (`lib/business-log.ts`, `app/(shell)/log/page.tsx`)
- Full theme/skin engine (built-ins, JSON install, VS Code import) — backlog 4.6–4.9
- Electron desktop packaging (`electron/main.mjs`)
- Functions page: org chart + merged automation analytics (`app/(shell)/functions/page.tsx`, `components/functions/*`)

**Scaffold / disconnected (do not treat as complete):**
- Personnel — workshop mentions + prompts wired; automation agent bind still open (4.10)
- BusinessDecision — Prisma model only; no API (4.12)

**Dev-gated tooling:**
- God Mode — diagram canvas overview (4.13)
- Cronalytics — Hermes cron observability (4.14)
- Decisions — placeholder page (4.12)

---

## Most glaring mistakes

### 1. Feature islands — UI promises integration that doesn't exist (highest impact)

Features that look finished in navigation but don't participate in the core value chain.

| Feature | Risk | Current state (post-remediation) |
|---------|------|--------------------------------|
| Personnel | Hire copy implied workshop assignment | **Fixed** — workshop mentions + prompts wired; automation bind still open |
| Swimlane standard | Lanes from roster | **Partial** — diagram prompt prefers roster lanes when standard is swimlane/auto |
| Rich composer `@` mentions | Actor/department/system | **Partial** — actors + roles + diagram nodes; systems still open |
| BusinessDecision | Governance record | **Open** — schema only |
| Git `personnel.json` | Round-trip import | **Done** — import restores personnel + docs + processes (4.11) |

### 2. Documentation drift — **largely fixed (AUDIT-1)**

`PRODUCT_BACKLOG.md` baseline was stale (old `/projects` paths, missing personnel/log/themes). Baseline and terminology section updated 2026-07-07. Keep backlog in sync when shipping features outside numbered items.

### 3. Terminology chaos — **UI pass done (AUDIT-9)**

| Concept | Database | UI label |
|---------|----------|----------|
| Tenant | `Business` | "business" (legacy: "project" in some components) |
| Workflow map | `Process` | "process" |
| Department | `Process.department` | "function" |

### 4. Nav rail overload — **partially fixed (AUDIT-4, AUDIT-5)**

Was 9 always-visible items including overlapping Functions / God Mode / Dashboard. **Now 7:** Home, Functions, Personnel, Workshop, Automations, Business log. God Mode, Decisions, Cronalytics are dev-gated.

### 5. Legacy discovery flow — **fixed (AUDIT-3)**

Interview + `/api/extract` removed. Primary flow: Home → `start-from-brief` → Workshop + Questions panel.

### 6. Schema ahead of product — **partial (AUDIT-7)**

`BusinessDecision` remains schema-only (honest scaffold copy). Unused `PERSONNEL_REMOVED` removed — fire uses `personnel.fired`. Personnel git import and full 4.12 API still open. Inert Git mirror fields on `Business` unchanged.

### 7. Zero automated tests — **partial (AUDIT-8)**

Unit smoke suite: `npm test` → `tests/unit/*.test.ts` (process-md, templates, home-prompt, log types, export filename). No HTTP/SSE/Electron integration tests yet.

### 8. Repo hygiene — **mostly done (AUDIT-8)**

SQLite WAL sidecars gitignored; duplicate `next.config.mjs` removed; accent module removed; unit tests added.

### 9. Theme over-investment vs. BPM backlog — **partially addressed**

10 skins / VS Code import remain. PROCESS.md (4.2), template library (4.1), and PNG/PDF export (3.8) foundation shipped 2026-07-09.

### 10. Security footgun on test endpoints — **open**

`/api/hermes/test` and `/api/n8n/test` accept arbitrary `baseUrl` (SSRF risk on shared hosts).

---

## Missing features

### From backlog — still pending or partial

| ID | Item | Status |
|----|------|--------|
| 2.4 | Function status lifecycle badges | Deferred |
| 3.4 | Fork-from-message UI; delete/rename conversation | Partial |
| 3.5 | `@department` / `@system` / actor mentionables | Partial |
| 3.8 | PNG/PDF export; server export API | **Done** (client PNG/PDF; server route deferred) |
| 4.1 | Workflow template library as repo files | **Done** |
| 4.2 | Per-business `PROCESS.md` contract | **Done** (generated + Git + chat inject) |
| 4.3 | Template marketplace / import | Pending |
| 4.5 | Integrations page | Pending |
| 4.15 | Desktop multi-tab shell | Planned — see `DESKTOP_MULTI_TAB_SHELL.md` |

### Needed for product coherence (not all in backlog)

1. Personnel ↔ process (assignees, swimlanes, chat/diagram context) — deferred after honesty pass
2. Personnel ↔ automation (`hermesAgentProfileId`)
3. ~~Human edit CRUD + show `roleDescription` on cards~~ **done**
4. BusinessDecision implementation or schema removal
5. ~~Git import round-trip (`personnel.json`, etc.)~~ **done** (4.11 push + restore import)
6. `ARCHITECTURE.md` reference doc (`PROCESS.md` schema ref shipped)
7. Minimal API smoke tests

---

## Redundant or safe to remove

### High confidence — dead code

| Item | Path | Status |
|------|------|--------|
| `HumanPersonnelCard` | `components/personnel/HumanPersonnelCard.tsx` | **Removed** |
| `PersonnelIcon` | `components/personnel/PersonnelIcon.tsx` | **Removed** |
| Interview page + extract API | `app/interview/`, `app/api/extract/` | **Removed** |
| Dashboard page | `app/(shell)/dashboard/page.tsx` | **Removed** (merged into Functions) |
| Accent preset API | `lib/accent.ts` | **Removed** (migration inlined in theme storage) |
| Dead accent swatch CSS | `app/globals.css` | **Removed** |
| Duplicate Next config | `next.config.mjs` vs `next.config.ts` | **Removed** `.mjs` |
| `PERSONNEL_REMOVED` event | `lib/business-log-types.ts` | Pending |
| Unused theme exports | `lib/themes/*` | Pending |

### Medium confidence

| Item | Recommendation | Status |
|------|----------------|--------|
| God Mode in nav | Dev-gate | **Done** |
| Dashboard | Merge into Functions | **Done** |
| Duplicate skin picker | `SettingsMenu` → `<SkinPicker compact />` | Pending |
| `ThemeDesignSystemPreview` | Dev-gate or remove | Pending |
| Overlapping skin presets | Consolidate or add light palettes | Pending |

### Low confidence — keep, don't expand until wired

Cronalytics, business log/git materialize (partial import), VS Code theme import, `BusinessDecision` schema.

---

## Recommended priority (remaining)

```mermaid
flowchart TD
  P7["Schema honesty AUDIT-7"] --> P10["Personnel integration"]
  P8["API smoke tests AUDIT-8"] --> Core["Core polish"]
  P10 --> Core
  Core --- C1["4.15 desktop multi-tab"]
  Core --- C2["4.5 integrations / 4.12 decisions"]
```

1. **AUDIT-7 / 4.12** — implement Decisions API or drop schema
2. **4.10 remainder** — automation ↔ hired agent binding
3. **4.16** code signing when shipping desktop
4. Optional: HTTP-level API smoke against a running server

---

## Bottom line

The **workshop core is strong**. 2026-07-07 fixed documentation truthfulness, personnel honesty, nav thinning, and overview consolidation. **2026-07-09** shipped PNG/PDF export, PROCESS.md foundation, template JSON library, terminology pass, and most dead-code cleanup. Remaining damage is **personnel/decision scaffolding**, **schema stubs**, and **missing automated tests**.

---

*Original audit produced in agent session 2026-07-07. Previously stored only in an ephemeral Grok plan file; committed here as the canonical reference. Updated 2026-07-09 for Tier A implementation.*