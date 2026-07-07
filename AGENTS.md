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

---

## 2. Project Overview

Hermes Forge is an **agent-native business process mapping studio** powered by Hermes Agent.

Core philosophy (inspired by Open Design):
- Brief / prompt → structured artifact (diagram + process model) → critique / iteration → deliverable
- Hermes does the heavy reasoning
- The UI is a "studio" shell, not a traditional CRUD app

See `docs/references/PRODUCT_BACKLOG.md`, `docs/references/audit.md`, and `docs/references/INDEX.md` for detailed priorities and known tech debt.

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

Desktop builds and GitHub Releases are **not automated**. There is no CI workflow and `desktop:build` does **not** publish. Agents asked to cut a desktop release must follow this checklist end-to-end — do not hand steps back to the user unless blocked (e.g. missing GitHub credentials).

### When this applies

- User asks to package, release, or ship a new desktop version.
- Bumping `package.json` version for a desktop build.

### Version sources (keep in sync)

Update all three before building:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `package-lock.json` | root `"version"` and `packages[""].version` |
| `lib/app-meta.ts` | `APP_VERSION` |

Tag format: `v{version}` (e.g. `v0.2.1`). Electron and the in-app About screen read from these.

### Pre-flight

1. Work from `main` (or merge feature work first).
2. Stop running dev/desktop instances — or run prebuild cleanup:
   ```powershell
   npm run desktop:prebuild
   ```
   This kills stale Hermes Forge / Next dev processes and deletes `dist/desktop/`.

3. **Lint caveat:** ESLint does not ignore `dist/`. Always run `desktop:prebuild` (or delete `dist/desktop/`) before `npm run lint`, or eslint will scan packaged artifacts and report thousands of false positives. Lint has pre-existing source warnings/errors; **production build + desktop smoke tests are the release gate**, not a clean lint run.

### Build and verify

```powershell
npm run build                              # TypeScript + Next.js — must pass
npm run desktop:build                      # prebuild → build → prepare → electron-builder
npm run desktop:test                       # launches win-unpacked, expects /login on port 3857
powershell -File scripts/test-standalone-prisma.ps1
powershell -File scripts/test-packaged-prisma.ps1
```

All of the above must pass before publishing.

### Build outputs (`dist/desktop/`)

| Artifact | Purpose |
|----------|---------|
| `Hermes Forge Setup {version}.exe` | NSIS installer (local filename has spaces) |
| `Hermes Forge Setup {version}.exe.blockmap` | Delta-update block map |
| `latest.yml` | Auto-updater manifest (`electron-updater`) |
| `win-unpacked/` | Unpacked app (used by `desktop:test`) |

`package.json` → `build.publish` points at `karmsheel/hermes-forge`, but publishing only happens if you explicitly run `electron-builder --publish` with `GH_TOKEN` — **not** part of the current workflow.

### Git: commit and tag

```powershell
git add package.json package-lock.json lib/app-meta.ts
git commit -m "chore: bump version to {version} for desktop release"
git tag -a v{version} -m "Hermes Forge {version}"
git push origin main
git push origin v{version}
```

Summarize changes since the previous tag (`git log v{prev}..HEAD --oneline`) for release notes.

### GitHub Release: publish (preferred)

**Use `electron-builder` to publish** — same path that worked for v0.2.0. Do not hand-upload assets via raw API unless publish is blocked.

```powershell
# Token from git credential helper or a PAT with repo scope
$env:GH_TOKEN = (("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n" |
  Where-Object { $_ -like "password=*" }) -replace "password=", ""

npx electron-builder --win nsis --publish always --prepackaged dist/desktop/win-unpacked
```

This uploads `Hermes-Forge-Setup-{version}.exe`, `.blockmap`, and `latest.yml` with correct names.

**Critical — verify the release is not a draft.** `electron-builder` may create a **draft** release on an `untagged-…` URL. That breaks the public Releases page (shows old version as Latest; assets fail to load). After publish, check via API:

```powershell
# Must show: draft=False, html_url ending in /releases/tag/v{version}
# Must have assets: Hermes-Forge-Setup-{version}.exe, .blockmap, latest.yml
```

If `draft=True` or URL contains `untagged-`, PATCH the release (`draft: false`, `make_latest: true`, proper `name` and release notes). **Never delete a published release** unless you can complete republish in the same session.

Fallback: manual API upload only if `electron-builder --publish` fails. Use hyphenated filenames — `latest.yml` references `Hermes-Forge-Setup-…`, not the spaced local NSIS output.

Release notes template:

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

### Publishing without `gh` CLI

`gh` may be installed but not authenticated. Alternatives agents should use:

- **GitHub REST API** with a token from `git credential fill` (host `github.com`).
- **`gh auth login --with-token`** if the stored token has sufficient scopes.

Upload endpoint: `POST {release.upload_url}?name={filename}` with `Content-Type: application/octet-stream`. The installer is ~400+ MB — allow several minutes for upload.

### Client auto-update (already automatic)

Installed desktop apps use `electron-updater` (`electron/auto-update.mjs`) to poll GitHub Releases and read `latest.yml`. No extra step after assets are uploaded correctly.

### Do not commit

- `dist/desktop/` (build output)
- Ephemeral one-off publish scripts created during a release session

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