# Forge Overlord — Design Spec

**Date:** 2026-07-18  
**Status:** Approved for implementation planning  
**Backlog relationship:** Evolves Phase 6 Foundation agent identity (was **Underlord**) and first-run hire UX (was per-business `/personnel/hire?required=1`).

---

## 1. Problem

Today, first-run looks like:

1. Sign in → **Business Manager**
2. Create a business → forced **per-business** agent hire (`/personnel/hire?required=1`)
3. Enter Foundation / studio

That gate is business-scoped (`HermesAgentProfile.businessId`), only supports **scanning existing** Hermes profiles (no spawn), and is framed as “hire an agent for this business,” not as choosing the sole Forge co-pilot.

Users need to:

- Choose a **Forge Overlord** (sole assistant for Forge-related work) **before** Business Manager
- Either **select an existing Hermes profile** or **spawn a new profile** on disk
- Enter Business Manager and start the first business **without** another forced hire

---

## 2. Goals

| Goal | Success signal |
|------|----------------|
| App-wide Overlord | One selection per User, not per Business |
| Before Business Manager | After auth, unset Overlord → setup screen; only then `/business-manager` |
| Existing or spawn | Pick scanned profile **or** create `profiles/<slug>/` under Hermes home |
| No forced per-business hire | `HireRequiredGate` removed; create business → Foundation (or BM list) without hire redirect |
| Naming | Product identity **Overlord** replaces **Underlord** in UI + agent refs |
| Chat still works | With zero hired agents, chatbar uses Overlord via **lazy hire** into the active business |

### Non-goals

- Multi-overlord / team of app-level agents
- Per-business override UI for “this business uses a different overlord”
- Mass-firing or rewriting existing business hires when Overlord changes
- Full rewrite of Personnel hire into Overlord management
- Marketing pack renames in `docs/marketing/*` (optional follow-up)
- Inventing Hermes features beyond directories `scanHermesProfiles` already understands

---

## 3. User journey

```text
Sign in
  → if User.forgeOverlordProfileKey is null
        → /setup/overlord  (cannot skip)
        → pick existing OR spawn new → set Overlord
  → /business-manager
  → create / open business
  → Foundation / studio  (no /personnel/hire?required=1)
```

**Change later:** Profile and/or Settings expose “Change Forge Overlord” → same setup UI (pre-selected current) → updates User fields only.

**Existing users:** First navigation after this ships with unset Overlord is gated to setup even if businesses already exist.

---

## 4. Architecture (Approach A)

### 4.1 Data model

Extend `User` (Prisma):

| Field | Type | Notes |
|-------|------|--------|
| `forgeOverlordProfileKey` | `String?` | Hermes profile key (`default` or directory name under `profiles/`) |
| `forgeOverlordDisplayName` | `String?` | Snapshot at selection time |
| `forgeOverlordHermesHome` | `String?` | Absolute path of that profile home at selection time |
| `forgeOverlordSetAt` | `DateTime?` | When set / last changed |

**Unset Overlord** = `forgeOverlordProfileKey` is null.

`HermesAgentProfile` remains **business-scoped** for optional extra hires (Personnel, automations, multi-agent chat). It is **not** the source of truth for the app Overlord.

### 4.2 Routes & gates

| Piece | Behavior |
|-------|----------|
| `/setup/overlord` | Full-bleed setup (shell chrome minimal or none, similar to forced hire layout) |
| `OverlordRequiredGate` | Replaces `HireRequiredGate` in `AppShell` |
| Exempt paths when unset | `/setup/overlord`, and signed-in account surfaces needed to not dead-end (e.g. `/settings`, `/profile`) — **not** `/business-manager` |
| Post-auth default | Auth redirect targets: resolve Overlord → else setup; else `/business-manager` |
| Business create | Stop `router.push("/personnel/hire?required=1")` in `ShellContext`; go to Foundation (or current post-create destination) |

Optional extra agents: keep `/personnel/hire` without `required=1` for voluntary hires.

### 4.3 Overlord setup UI

Full-bleed page:

1. Eyebrow: **Forge Overlord**
2. Title: **Choose your Forge Overlord**
3. Subtitle: this agent is your sole assistant for managing Forge-related business work
4. **Existing profiles:** scan grid (reuse `AvailableAgentCard` patterns or a dedicated select card); Rescan
5. **Spawn new:** secondary CTA opens inline form — required **name**, optional **description** → creates profile → selects it
6. Primary confirm: **Continue to Business Manager** (enabled only when a selection is made / just spawned)
7. Cannot dismiss / skip while unset

### 4.4 Spawn contract

`POST` API (e.g. `/api/hermes/profiles` or `/api/overlord/spawn`):

1. Resolve Hermes home via `getHermesHome()`
2. Slugify display name → safe `profileKey` (filesystem-safe, non-empty)
3. Reject if key is `default`, empty, or collides with existing scan results / existing dir
4. Create `{hermesHome}/profiles/{profileKey}/`
5. Write minimal `profile.yaml` (`name` / `description` scalars that `scanHermesProfiles` can parse)
6. Write minimal `config.yaml` only if needed for Hermes/scan compatibility (keep minimal)
7. Return scanned profile shape; caller sets Overlord on User

Do **not** clone the entire default profile directory in v1.

### 4.5 Chat / agent wiring (lazy hire)

When the active business has **zero hired** `HermesAgentProfile` rows:

1. Chatbar synthesizes the Overlord as the only agent option (display from User fields)
2. On first chat / conversation create that needs an agent FK, **lazy-hire**: ensure a `HermesAgentProfile` for `(businessId, profileKey)` exists with `isHired: true`, `isDefault: true` if appropriate
3. Existing `Conversation.hermesAgentProfileId` and studio APIs keep working without a large schema rewrite

When the business already has hired agents, current multi-agent picker behavior stays; Overlord is not required to appear in the list unless already hired.

Empty hire empty-state CTAs that point at `/personnel/hire?required=1` should point at Overlord setup or optional hire instead.

### 4.6 Rename: Underlord → Overlord

Replace user-facing **Underlord** with **Overlord** (or **Forge Overlord** where “Forge” disambiguates) in:

- Foundation UI (`FoundationRoom`, `FoundationCanvas`, Home hero blurb)
- `lib/foundation.ts` prompt addon
- `lib/chatbar/page-registry.ts`, studio prompt tests, foundation unit tests
- `AGENTS.md`, `docs/references/BUSINESS_PLANT_PFD.md`, `PRODUCT_BACKLOG.md` (and INDEX if needed)

**Decision log entry:** Foundation co-pilot identity is **Overlord** (formerly Underlord). Room name remains **Foundation**.

Marketing packs under `docs/marketing/` are out of scope for this change.

---

## 5. API surface (indicative)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/overlord` | Current Overlord + whether set |
| `PUT /api/overlord` | Set Overlord from `{ profileKey }` after scan validation |
| `POST /api/overlord/spawn` (or hermes profiles) | Create profile on disk + optionally set as Overlord |
| Existing `POST /api/personnel/agents` scan | Reuse for listing candidates on setup screen |
| Auth/me | Include Overlord summary so client gate does not need a second round-trip if practical |

Lazy hire can be a small helper used by chatbar conversation create and/or a dedicated internal ensure function — not necessarily a public “hire Overlord” button.

---

## 6. Components / files (expected touch list)

| Area | Files (approx.) |
|------|------------------|
| Schema | `prisma/schema.prisma` (+ migrate) |
| Gate | Replace `components/personnel/HireRequiredGate.tsx` → `OverlordRequiredGate` (or rewrite in place) |
| Shell | `AppShell.tsx`, `ShellContext.tsx` (post-create route) |
| Setup page | `app/(shell)/setup/overlord/page.tsx` (or route group without full nav) |
| Auth redirects | `sign-in`, `AuthForm`, `SignInOptions` default `/business-manager` → overlord-aware |
| Chatbar | `ChatbarPanel.tsx` empty / hire CTAs; ensure Overlord lazy hire |
| Foundation / copy | foundation components + `lib/foundation.ts` + page-registry |
| Docs | BUSINESS_PLANT_PFD, backlog, AGENTS |
| Tests | foundation + studio-prompt Underlord assertions; new overlord unit tests for slug/spawn/gate helpers |

---

## 7. Edge cases

| Case | Behavior |
|------|----------|
| Hermes missing / zero profiles | Show spawn + install guidance; spawn creates `profiles/` under resolved home when possible |
| Spawn name collision | 409 + message; user picks another name or existing profile |
| Change Overlord | Updates User only; does not fire existing business agents |
| Business with hired agents | No forced hire; optional Personnel hires remain |
| Gate vs settings | Unset Overlord can open Settings/Profile so user is not trapped without account chrome; cannot use Business Manager / studio rooms until set |

---

## 8. Testing plan

- Unit: slugify + collision rules; “unset Overlord” detection; foundation prompt contains Overlord not Underlord
- Unit: lazy-hire ensure is idempotent for `(businessId, profileKey)`
- Manual / smoke: fresh user → setup → BM → create business → Foundation without hire redirect; chatbar has Overlord; rescan + spawn path
- Regression: Personnel optional hire still works; automations that need a hired agent still require a hired profile (lazy hire or manual)

---

## 9. Rollout notes

- Desktop: schema migrate via existing Prisma path so `User` columns exist in packaged DB
- No electron-builder / release required for design-only; implementation may ship in a normal app version bump later

---

## 10. Decision log (this feature)

| Date | Decision |
|------|----------|
| 2026-07-18 | Forge Overlord is **app-wide** (User-level), chosen **before** Business Manager |
| 2026-07-18 | Skip forced per-business first hire; Overlord is enough for studio entry |
| 2026-07-18 | Spawn writes a real Hermes profile under `profiles/<slug>/` |
| 2026-07-18 | Architecture: User fields + `OverlordRequiredGate` (Approach A) |
| 2026-07-18 | Chat uses **synthetic Overlord + lazy hire** for FKs |
| 2026-07-18 | Rename **Underlord → Overlord** in product UI + agent reference docs |
| 2026-07-18 | Existing users with unset Overlord are gated once to setup |

---

## 11. Open questions for implementation plan (not product blockers)

- Exact route group: `(shell)/setup/overlord` vs top-level `app/setup/overlord` without nav rail
- Whether `/api/auth/me` always returns overlord fields (preferred for gate simplicity)
- Minimal `config.yaml` contents — match whatever local Hermes expects for a usable empty profile (verify against installed Hermes during implement)

These can be resolved in the implementation plan without reopening product design.
