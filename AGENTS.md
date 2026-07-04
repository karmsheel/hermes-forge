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

Use the methods above to load them.

### Current Reference Files

See `docs/references/INDEX.md` for the full list.

Key files:
- `PRODUCT_BACKLOG.md` — The source of truth for what to build next

---

## 2. Project Overview

Hermes Forge is an **agent-native business process mapping studio** powered by Hermes Agent.

Core philosophy (inspired by Open Design):
- Brief / prompt → structured artifact (diagram + process model) → critique / iteration → deliverable
- Hermes does the heavy reasoning
- The UI is a "studio" shell, not a traditional CRUD app

See `docs/references/PRODUCT_BACKLOG.md` and `docs/references/INDEX.md` for detailed priorities.

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
- When implementing a feature from the backlog, reference the specific item.
- Keep UI minimal. The diagram and process model carry the visual weight.
- Use the token system in `app/tokens.css` (see backlog Phase 1.1).
- All new major UI should follow the patterns in the workshop/home/shell components.

---

## 6. Adding or Updating Reference Material

1. Place the file in `docs/references/`
2. Update `docs/references/INDEX.md`
3. Commit the change on `main`
4. If the new file affects how agents should behave, document it here in `AGENTS.md`

---

## 7. Next.js Specific Notes

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

**End of AGENTS.md**

When in doubt, re-read the Reference Files section and load the backlog.