# Agent Reference Files — Hermes Forge

This directory holds **canonical reference documents** that agents should consult when working on Hermes Forge.

## Core Principle

Reference files live in `docs/references/` and are **committed to the repository**.

When using **Git worktrees** (highly recommended for this project), never rely on the file existing in your current working directory. Always load the authoritative version from the `main` branch.

## How Agents Must Load References

### Preferred Method (worktree-safe)
```powershell
git show main:docs/references/PRODUCT_BACKLOG.md
```

### Convenience Helper
```powershell
# From anywhere in the repo (including worktrees)
.\scripts\get-reference.ps1 PRODUCT_BACKLOG.md
```

This script writes the latest version from `main` into your current directory.

### In Code / Hermes Agent Context
Use the git show approach or the helper at startup of any agent session. Consider caching the content for the current task.

## Reference File Inventory

| File                        | Purpose                                      | Priority | When to Read |
|----------------------------|----------------------------------------------|----------|--------------|
| `PRODUCT_BACKLOG.md`       | Full product backlog, phases, and tasks     | High     | Before choosing or implementing any feature |
| `INDEX.md` (this file)     | Manifest of all references                   | High     | At the start of any agent session |
| *(Future)* `ARCHITECTURE.md` | System design, data model, key decisions   | Medium   | When touching core systems |
| *(Future)* `PROCESS.md`    | Process notation standards & contracts      | Medium   | When building diagram/workflow features |
| *(Future)* `DESIGN.md`     | Visual & interaction guidelines             | Low      | When working on UI components |

## Agent Session Checklist

1. Read root `AGENTS.md`
2. Read `docs/references/INDEX.md`
3. Read relevant files from the table above (use `git show main:...` or the helper script)
4. Only then start planning or coding

## Adding New Reference Files

1. Create the file in `docs/references/`
2. Update this `INDEX.md` table
3. Commit to `main`
4. Update `AGENTS.md` if the file changes agent behavior significantly

## Notes for This Project

- Hermes Forge is built with heavy use of **Git worktrees**.
- The Hermes Agent inside the app (and external agents like Grok/Claude) must be able to access up-to-date project knowledge.
- Reference files should be **human + agent readable** Markdown.
- Avoid putting secrets, local config, or transient notes here.

This convention ensures that no matter which branch or worktree an agent is operating in, it always works from the current source of truth.