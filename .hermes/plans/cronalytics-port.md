# Cronalytics Port — Implementation Plan

**Goal:** Replicate the Cronalytics plugin (https://github.com/8bit64k/cronalytics, v1.1.0) as a native page in Hermes Forge. The user wants the page to "feel like we are installing the plugin" — same data model, same API surface, same UI shape — but written in our Next.js/TypeScript stack and using our design system.

**Scope decision:** full port (per user direction). Not an integration; we own the implementation.

---

## What we're porting (and what we're not)

### Port (in TypeScript / Next.js)

| Original | Replacement |
| :--- | :--- |
| `cronalytics/facts.py` (SQLite fact DB, schema, ingest) | `lib/cronalytics/db.ts` + `lib/cronalytics/scanner.ts` |
| `cronalytics/scanner.py` (watermark-based sync) | `lib/cronalytics/scanner.ts` |
| `cronalytics/jobs.json` loader + job-name enrichment | `lib/cronalytics/jobs.ts` |
| `cronalytics/schedule.py` (cron expr parsing, pace) | `lib/cronalytics/schedule.ts` |
| `dashboard/plugin_api.py` (FastAPI routes) | `app/api/cronalytics/{health,sync,summary,jobs,models,trends}/route.ts` + `app/api/cronalytics/jobs/[id]/runs/route.ts` |
| `dashboard/src/components/*.js` (13 React components) | `components/cronalytics/*.tsx` in our design system |
| `dashboard/src/index.js` registration entry | `app/(shell)/cronalytics/page.tsx` |

### NOT porting (out of scope for v1)

- The **Python CLI** (`cronalytics/cli.py`) — the user has a UI now; CLI is redundant. If wanted later, it can be added as a Next.js admin view or a small `scripts/cronalytics-cli.ts`.
- The **agent skill** (`skills/cronalytics/SKILL.md` + 5 reference docs) — the user mentioned "I eventually want to replicate some of those features in my own page." That's future work, not this port.
- The **i18n catalogs** (en/es/zh/zh-hant) — our app is English-only. We will keep one English copy.
- The `plugin.yaml` and plugin loader hook — we are not building a plugin system in Hermes Forge. Cronalytics is just a route.

---

## Architecture

### Data flow

```
                      ┌─────────────────────────────┐
                      │ Hermes (read-only)          │
                      │                             │
                      │ state.db (sessions)         │◄─── node:sqlite
                      │ cron/jobs.json              │◄─── fs read
                      └──────────────┬──────────────┘
                                     │
                          scanner.sync() on demand
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │ data/cronalytics-facts.db   │
                      │ (project-local SQLite)      │
                      │                             │
                      │ cron_runs table             │
                      │ sync_watermark table        │
                      └──────────────┬──────────────┘
                                     │
                          API routes (Next.js)
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │ app/(shell)/cronalytics/    │
                      │  (React page in shell)      │
                      └─────────────────────────────┘
```

The fact DB lives at **`data/cronalytics-facts.db`** in the project root (gitignored, like `dev.db`). Hermes's `state.db` is opened read-only — we never write to it. This matches Cronalytics' design exactly (separate fact DB, source-of-truth stays Hermes).

### Hermes home resolution

The user's Hermes install lives at `C:\Users\karms\AppData\Local\hermes\` (not `~/.hermes`). Resolution order:

1. `process.env.HERMES_HOME` if set
2. `~/.hermes` (POSIX path) — for non-Windows or users who set it
3. `%LOCALAPPDATA%\hermes` on Windows, else `~/Library/Application Support/hermes` on macOS, else `~/.local/share/hermes` on Linux

`state.db` is then `${HERMES_HOME}/state.db` (and for the active profile: `${HERMES_HOME}/profiles/<profile>/state.db`). Default to top-level `state.db` to match Cronalytics. Configurable later.

### Data model (matches `skills/cronalytics/references/data-model.md`)

```
cron_runs(
  session_id TEXT PK,
  job_id TEXT NOT NULL,
  run_time REAL NOT NULL,         -- sessions.started_at
  ended_at REAL,
  duration_seconds REAL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  estimated_cost_usd REAL,
  actual_cost_usd REAL,
  cost_status TEXT,
  cost_source TEXT,
  billing_provider TEXT,
  api_call_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  end_reason TEXT,
  success INTEGER,                -- 0/1
  job_mode TEXT DEFAULT 'agent',  -- 'agent' | 'no_agent'
  ingested_at REAL                -- unixepoch
)

sync_watermark(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_ended_at REAL NOT NULL,
  last_sync TEXT NOT NULL,        -- ISO
  rows_synced INTEGER NOT NULL
)
```

### API surface (matches Cronalytics' 7 routes exactly)

All routes live under `/api/cronalytics/*` (our path, not the original `/api/plugins/cronalytics/*` — we're not a plugin). All return JSON. All accept query params: `days` (default 30, 0 = all time), `outcome` (`all`|`success`|`failure`), `mode` (`all`|`agent`|`no_agent`).

| Method | Path | Response |
| :--- | :--- | :--- |
| GET | `/api/cronalytics/health` | `{ok, fact_db_path, sync: {last_sync, last_ended_at, rows_synced}}` |
| POST | `/api/cronalytics/sync` | `{result: {inserted, elapsed_ms}}` |
| GET | `/api/cronalytics/summary` | Aggregates + `previous_period` comparison |
| GET | `/api/cronalytics/jobs` | `{jobs: [...]}` with pace metadata |
| GET | `/api/cronalytics/jobs/[id]/runs` | `{runs: [...]}` individual runs |
| GET | `/api/cronalytics/models` | Per-model cost breakdown |
| GET | `/api/cronalytics/trends` | Daily buckets for sparkline |

### UI

Mirror CronalyticsTab's component tree but in our stack:

- `HeroBanner` — title + sync button + last-sync time
- `SummaryBoard` — 6 stat cards (runs, success, failure, cost, tokens, avg duration) with previous-period deltas
- `LeaderBoard` — top-N jobs by cost, with click-through
- `JobBreakdown` — sortable table of all jobs
- `ModelBreakdown` — per-model cost
- `JobDetailView` (modal) — per-job runs with sparkline of cost over time
- `DaySelector`, `OutcomeToggle`, `ModeToggle` — filter controls (localStorage-persisted like the original)
- `Modal` — generic modal shell
- `SparkLine` — small SVG sparkline

No new CSS framework. Uses our existing `.card`, `.app-shell`, token classes.

### File map (target)

```
app/(shell)/cronalytics/page.tsx
app/api/cronalytics/health/route.ts
app/api/cronalytics/sync/route.ts
app/api/cronalytics/summary/route.ts
app/api/cronalytics/jobs/route.ts
app/api/cronalytics/jobs/[id]/runs/route.ts
app/api/cronalytics/models/route.ts
app/api/cronalytics/trends/route.ts
lib/cronalytics/paths.ts
lib/cronalytics/db.ts
lib/cronalytics/types.ts
lib/cronalytics/jobs.ts
lib/cronalytics/scanner.ts
lib/cronalytics/schedule.ts
lib/cronalytics/aggregations.ts
components/cronalytics/CronalyticsTab.tsx
components/cronalytics/HeroBanner.tsx
components/cronalytics/SummaryBoard.tsx
components/cronalytics/LeaderBoard.tsx
components/cronalytics/JobBreakdown.tsx
components/cronalytics/ModelBreakdown.tsx
components/cronalytics/JobDetailView.tsx
components/cronalytics/DaySelector.tsx
components/cronalytics/OutcomeToggle.tsx
components/cronalytics/ModeToggle.tsx
components/cronalytics/Modal.tsx
components/cronalytics/SparkLine.tsx
components/cronalytics/formatters.ts
data/.gitignore (add cronalytics-facts.db)
```

Plus a sidebar entry in the shell nav (where the user expects, near `automations`).

---

## Dependencies

**Zero new npm packages.** The plan uses:

- `node:sqlite` (built into Node 24) for both reading Hermes `state.db` (read-only) and managing our fact DB.
- `cron-parser` (already in package.json from the in-progress install work) for cron expression parsing.
- Existing project deps for everything else (`lucide-react`, `sonner`, Tailwind tokens).

If `node:sqlite` turns out to be unsuitable for some reason (it sometimes has edge cases), fallback is `better-sqlite3` — but we shouldn't need it.

---

## Verification

1. Each API endpoint returns valid JSON, 200 status, with shape that matches the Cronalytics Python contract.
2. POST `/api/cronalytics/sync` actually reads the user's `state.db` and inserts cron sessions. We verify by counting `cron_runs` rows after sync.
3. The page renders at `/cronalytics` in the shell, with a sidebar entry.
4. `npm run lint` is clean.
5. Filters (days / outcome / mode) update the data.
6. Sync button works and shows a success toast.
7. Empty state (no cron jobs yet) renders gracefully — not an error.

---

## Out of scope / explicit non-goals

- The Python CLI tool. Not in the web app, doesn't belong here.
- The agent skill. Future work; user said "eventually."
- Multi-profile support. We read the top-level `state.db`. If users want per-profile, easy follow-up.
- Auto-discovery of Hermes home. We have a smart default for Windows + sane fallbacks; users on weird setups can set `HERMES_HOME`.
- Cost analytics beyond what the original supports. Same query shapes.

---

## Open question for the user (will ask at end)

The original Cronalytics has a "top runs / top cost / top tokens" leaderboard. Hermes Forge has its own shell + sidebar. I will mirror the existing `automations` page pattern. If the user wants a different placement, easy to move later.
