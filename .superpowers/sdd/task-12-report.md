# Task 12 Report — Backlog note + final verification

**Status:** Complete  
**Branch:** `feature/forge-overlord`  
**Date:** 2026-07-18

## Changes

### `docs/references/PRODUCT_BACKLOG.md`
- Added shipped checkbox under **4.10 Personnel** and **6.7 Entry-flow**:
  - App-wide Forge Overlord setup before Business Manager (spawn or existing profile); remove forced per-business first hire; Underlord renamed Overlord

### `docs/references/BUSINESS_PLANT_PFD.md`
- Decision log entry (2026-07-18): app-wide Forge Overlord setup before BM; no forced per-business first hire; changeable via profile

### `docs/references/INDEX.md`
- No change required (Overlord already linked via BUSINESS_PLANT_PFD)

## Verification

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass — schema valid |
| `npm test` | Pass — **197** tests, **0** fail (`duration_ms` ~1.6s) |
| `npm run build` | Pass — Next.js 16.2.9 compile + TypeScript + static gen (75 pages) |

Environment: `$env:DATABASE_URL="file:./prisma/dev.db"`

### Build notes (non-blocking)
- Next.js deprecation: middleware → proxy convention (pre-existing)
- Overlord routes present in build output: `/setup/overlord`, `/api/overlord`, `/api/overlord/ensure-hired`, `/api/overlord/spawn`

### Manual smoke (not executed in this task)
Brief listed 5 UI flows (fresh user → Overlord → BM → Foundation; chatbar ensure-hired; spawn; settings exempt; profile change). Automated suite covers unit paths for slug/paths/spawn/user/exempt; full E2E smoke remains manual.

## Commits

| SHA (short) | Message |
|-------------|---------|
| `4dd6dc2` | `docs: record Forge Overlord first-run and rename` |

Prior feature commits on branch (T1–T11): schema → helpers → spawn → API → gate → setup UI → routing → lazy hire → rename → profile change.

## Concerns

- Manual smoke not run in-agent (needs running app + Hermes home).
- `/personnel/hire` still listed in build routes — intentional residual path after removing *forced* first-hire gate; confirm product still wants optional hire entry if any.
- Pre-existing Next middleware deprecation warning only; no Overlord-related build failures.

## Fix (review findings — docs only)

Aligned backlog hire-gate wording with Overlord-first first-run (no forced per-business hire).

### `docs/references/PRODUCT_BACKLOG.md`
- **§ 6.2 shipped:** Rewrote entry bullet from “post-hire → Foundation (hire gate still first for new business)” to Overlord-first flow: app-wide Overlord → BM → create business → Foundation; optional personnel hire / lazy ensure-hired.
- **§ 6.2 partial:** Marked “Overlord persona in Foundation chat context” shipped (consistent with 6.6); marked “Foundation as first-class room in room switcher” shipped under 6.6.
- **§ 6.7:** Soft-edited “hire post-create” deliverable so start-from-brief → Foundation does not imply forced hire after create (optional hire / lazy ensure-hired only).

### Commit
- `docs: align backlog hire-gate wording with Overlord first-run`
