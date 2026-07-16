# AGENTS.md — Hermes Forge Agent Instructions

> **Always read this file first** before making any changes.

This document defines how agents (Grok, Hermes Agent, Claude, Cursor, etc.) should work in the Hermes Forge project.

---

## 1. Agent Reference Files Convention (Critical)

Hermes Forge uses **Git worktrees** heavily. Because of this, reference documents are **never** assumed to exist in the current working directory.

### Location
All agent reference material lives in:

```
docs/references/
```

### Authoritative Access (Worktree-Safe Rule)

**Never** just `cat` or `read_file` a reference assuming it's checked out locally.

**Correct ways to load references:**

#### Option A — Git show (recommended, always up-to-date)
```powershell
git show main:docs/references/PRODUCT_BACKLOG.md
```

#### Option B — Helper script (most convenient)
```powershell
.\scripts\get-reference.ps1 PRODUCT_BACKLOG.md
```

This script pulls the version from `main` and writes it into your current folder.

**Local copies are ephemeral.** Root-level `PRODUCT_BACKLOG.md` and `INDEX.md` (if present) are gitignored outputs from the helper scripts. Never edit or commit them — always change `docs/references/` on `main`.

### Required Reading Order at Start of Any Task

1. `AGENTS.md` (this file)
2. `docs/references/INDEX.md`
3. The specific reference file(s) relevant to the task (usually `PRODUCT_BACKLOG.md`)
4. When assessing repo health, tech debt, or "what's wrong / redundant": `docs/references/audit.md`

Use the methods above to load them.

### Current Reference Files

See `docs/references/INDEX.md` for the full list.

Key files:
- `PRODUCT_BACKLOG.md` — The source of truth for what to build next
- `audit.md` — Canonical project audit (mistakes, gaps, redundancy, remediation status)
- `BUSINESS_PLANT_PFD.md` — Phase 6 rooms, soft unlock, plant PFD, Foundation / Underlord (read when touching shell IA or Map/Foundation)

---

## 2. Project Overview

Hermes Forge is an **agent-native business process mapping studio** powered by Hermes Agent.

Core philosophy (inspired by Open Design):
- Brief / prompt → structured artifact (diagram + process model) → critique / iteration → deliverable
- Hermes does the heavy reasoning
- The UI is a "studio" shell, not a traditional CRUD app

**Long-horizon product thesis (Phase 6):** a business is a **designed plant**. The Forge is a place with **rooms** (Foundation → Map → Monitor → Automate), soft progressive unlock on **forged** processes, and Workshop as a **tool inside Map**. New businesses start in **Foundation** (agent persona **Underlord**); Map’s primary surface is the **plant PFD** (promoted God Mode canvas). Canonical model: `docs/references/BUSINESS_PLANT_PFD.md`. Priorities: `PRODUCT_BACKLOG.md` § Phase 6 (6.6 / 6.7 next).

See `docs/references/PRODUCT_BACKLOG.md`, `docs/references/audit.md`, `docs/references/BUSINESS_PLANT_PFD.md`, and `docs/references/INDEX.md` for detailed priorities and known tech debt.

---

## 3. Key Technical Context

- **Next.js 16** (App Router) with significant custom patterns — see the Next.js note at the bottom of this file.
- Heavy use of **Git worktrees** for parallel development.
- **Hermes Agent** is the primary reasoning engine (connected via OpenAI-compatible API).
- Local-first / BYOK model (user brings their own Hermes instance).
- SQLite + Prisma for now.
- Real-time diagram updates using Mermaid.
- Process chat is the main interface for refinement.

---

## 4. Worktree Workflow Expectations

This project expects developers and agents to use worktrees:

```powershell
# From main repo
git worktree add ../hermes-forge-my-feature -b feature/my-feature
cd ../hermes-forge-my-feature
```

When working in a worktree:
- Always load reference files using `git show main:...` or the helper script.
- Do **not** commit local copies of reference files unless you intentionally want to propose changes to them.
- Push your feature branch from the worktree as normal.

---

## 5. General Rules for Agents

- Prefer small, focused changes that can be reviewed easily.
- Update the backlog (via PR or discussion) when scope changes significantly.
- After fixing audit items, update `docs/references/audit.md` remediation table and `PRODUCT_BACKLOG.md` AUDIT-* statuses.
- When implementing a feature from the backlog, reference the specific item.
- Keep UI minimal. The diagram and process model carry the visual weight.
- Use the token system in `app/tokens.css` (see backlog Phase 1.1).
- All new major UI should follow the patterns in the workshop/home/shell components.

---

## 6. Desktop Release Workflow (Manual)

Desktop builds and GitHub Releases are **not automated**. There is no CI workflow; `npm run desktop:build` packages locally but **does not publish**. Agents asked to cut a release must run the full checklist below themselves — do not hand steps back to the user unless truly blocked (e.g. no GitHub token).

**Repo:** `https://github.com/karmsheel/hermes-forge` (not `Hermes-Business-Factory`).

### Canonical order (do not reorder)

1. Bump versions → build → test
2. Commit version bump → tag → push `main` + tag
3. Publish to GitHub Releases via `electron-builder`
4. **Verify** release is public, tagged, and has 3 assets
5. Finalize draft if `electron-builder` left one

Skipping step 4 is how v0.2.1 broke: a draft on an `untagged-…` URL hid the release and broke the Assets UI.

### Version sources (keep in sync)

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `package-lock.json` | root `"version"` and `packages[""].version` |
| `lib/app-meta.ts` | `APP_VERSION` (auto-synced from `package.json` by `npm run build`) |

**UI version display:** Settings, nav rail, and the updater read the **runtime** version from `app.getVersion()` (Electron `package.json`) via the desktop preload bridge. Bump `package.json` before `npm run build` so both the packaged app and the Next bundle stay aligned.

Tag format: `v{version}` (e.g. `v0.2.1`). Tag should point at the **version-bump commit**; docs commits may land on `main` afterward.

### Step 1 — Pre-flight and build

```powershell
npm run desktop:prebuild                 # kill stale processes; delete dist/desktop/
npm run build                            # TypeScript + Next.js — must pass
npm run desktop:build                    # prebuild → build → prepare → electron-builder (no publish)
npm run desktop:test                     # expects /login on port 3857
powershell -File scripts/test-standalone-prisma.ps1
powershell -File scripts/test-packaged-prisma.ps1
```

**Lint:** ESLint ignores `.next/` but not `dist/`. Run `desktop:prebuild` before `npm run lint`, or eslint scans packaged artifacts and reports thousands of false positives. Lint has pre-existing source issues; **build + desktop tests are the gate**, not a clean lint run.

### Step 2 — Git commit and tag

```powershell
git add package.json package-lock.json lib/app-meta.ts
git commit -m "chore: bump version to {version} for desktop release"
git tag -a v{version} -m "Hermes Forge {version}"
git push origin main
git push origin v{version}
```

Release notes bullets: `git log v{prev}..HEAD --oneline`

### Step 3 — Publish to GitHub Releases

**Always prefer `electron-builder --publish`** (worked for v0.2.0). Avoid raw REST API uploads — they use wrong content-types and skip `latest.yml` orchestration.

```powershell
$env:GH_TOKEN = (("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n" |
  Where-Object { $_ -like "password=*" }) -replace "password=", ""

npx electron-builder --win nsis --publish always --prepackaged dist/desktop/win-unpacked
```

- Uploads `Hermes-Forge-Setup-{version}.exe`, `.blockmap`, and `latest.yml`
- Installer upload is ~400+ MB — allow 10–15 minutes; do not kill the process early
- `GH_TOKEN` needs `repo` scope (git credential helper usually works; `gh` may be installed but not logged in)

Local NSIS output uses spaces (`Hermes Forge Setup {version}.exe`); published assets use hyphens (`Hermes-Forge-Setup-{version}.exe`). `latest.yml` references the hyphenated name.

### Step 4 — Post-publish verification (mandatory)

Run these checks before telling the user the release is live:

```powershell
$token = (("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n" |
  Where-Object { $_ -like "password=*" }) -replace "password=", ""
$headers = @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json" }
$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/karmsheel/hermes-forge/releases?per_page=5" -Headers $headers
$r = $releases | Where-Object { $_.tag_name -eq "v{version}" } | Select-Object -First 1
```

| Check | Pass condition |
|-------|----------------|
| Release exists | `$r` is not null |
| Not a draft | `$r.draft -eq $false` |
| Correct URL | `$r.html_url` ends with `/releases/tag/v{version}` (no `untagged-`) |
| Assets | Exactly: `Hermes-Forge-Setup-{version}.exe`, `.blockmap`, `latest.yml` |
| Download | `Invoke-WebRequest` HEAD on `…/releases/download/v{version}/Hermes-Forge-Setup-{version}.exe` returns 200 |

If `GET …/releases/tags/v{version}` returns 404 but a draft exists with `tag_name=v{version}` and `untagged-` in the URL → go to Step 5.

### Step 5 — Finalize draft releases

`electron-builder` often creates a **draft** release at `…/releases/tag/untagged-{hash}`. While draft:

- The public Releases page still shows the **previous** version as Latest
- The Assets section may show "Uh oh! There was an error while loading"
- `GET …/releases/tags/v{version}` returns 404

**Fix:** PATCH the release by id (from the list endpoint — do not rely on get-by-tag):

```powershell
$body = @{
  tag_name = "v{version}"
  target_commitish = "main"
  name = "Hermes Forge {version}"
  body = "<release notes markdown>"
  draft = $false
  prerelease = $false
  make_latest = "true"
} | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "https://api.github.com/repos/karmsheel/hermes-forge/releases/$($r.id)" `
  -Method Patch -Headers $headers -Body $body -ContentType "application/json; charset=utf-8"
```

Re-run Step 4 checks after patching.

### Failure modes (lessons from v0.2.1)

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Hand-uploaded assets via REST API | Release exists but Assets UI broken; wrong content-types | Republish via `electron-builder --publish` |
| Deleted release to "fix" it | Gap with no public release; tag orphaned | Publish via electron-builder; finalize draft |
| Left `electron-builder` draft unpublished | Old version still "Latest"; untagged URL | Step 5 PATCH |
| Killed publish mid-upload | Draft with partial/missing assets | Delete draft release only if republishing immediately |
| Pushed tag but never published | Tag on GitHub, no installer assets | Run Step 3 |
| Lint with `dist/desktop/` present | 20k+ false lint errors | Run `desktop:prebuild` first |

**Never delete a working published release** to fix asset display. Finalize drafts or republish in the same session.

### Release notes template

```markdown
## Hermes Forge {version}

Desktop release.

### Highlights
- (bullets from git log since previous tag)

### Install
Download **Hermes-Forge-Setup-{version}.exe** and run the installer.
Existing installs receive this update via the in-app updater.

### Notes
- Requires Hermes Agent for AI/chat features (`hermes gateway` on port 8642)
- Data and SQLite DB are stored in the Electron user-data folder
```

### Client auto-update

Installed apps use `electron-updater` (`electron/auto-update.mjs`) → GitHub Releases → `latest.yml`. No extra step once Step 4 passes.

### Do not commit

- `dist/desktop/` (build output)
- Ephemeral publish/debug scripts from a release session

---

## 7. Adding or Updating Reference Material

1. Place the file in `docs/references/`
2. Update `docs/references/INDEX.md`
3. Commit the change on `main`
4. If the new file affects how agents should behave, document it here in `AGENTS.md`

---

## 8. Next.js Specific Notes

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

**End of AGENTS.md**

When in doubt, re-read the Reference Files section and load the backlog.