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
| `audit.md`                 | Project audit: mistakes, gaps, redundancy, remediation progress | High | When planning cleanup, assessing repo health, or prioritizing tech debt |
| `INDEX.md` (this file)     | Manifest of all references                   | High     | At the start of any agent session |
| `hermes-desktop-design-system.md` | Hermes Desktop tokens, primitives, theme engine reference | Medium | When working on skins, themes, or UI convergence (4.6+) |
| `THEME_SCHEMA.md` | JSON schema for user-installable Forge themes | Medium | When building or documenting custom theme install (4.7) |
| `BUSINESS_LOG_AND_GIT.md` | Immutable business log + per-business Git versioning architecture | High | When implementing business log, export, sync, or GitHub integration |
| `DESKTOP_MULTI_TAB_SHELL.md` | Desktop multi-tab shell design (Notion-style parallel sessions) | Medium | When implementing desktop tab bar or per-tab business scoping (4.15) |
| `WINDOWS_CODE_SIGNING.md` | Windows Authenticode signing for NSIS installer and SmartScreen trust | Medium | When implementing desktop installer signing or release hardening (4.16) |
| `GLOBAL_CHATBAR.md` | Global shell chatbar: extension parity checklist, residency, page context protocol, PR plan (4.17) | High | When implementing or reviewing the elevated in-app Hermes chatbar |
| `BUSINESS_DOCUMENTS.md` | Business knowledge documents: kinds, schema, Hermes injection, Git layout (4.18) | High | When implementing or extending Documents / company knowledge context |
| `BUSINESS_PLANT_PFD.md` | Phase 6: Forge rooms, soft unlock, plant PFD, Foundation / Overlord, Map promotion of God Mode | High | When implementing rooms, Foundation, Map plant, 6.6/6.7, stage→room IA, or process links |
| *(Plan)* Map→Monitor→Automate | Phase 5 operating stages + Content inventory (see PRODUCT_BACKLOG § Phase 5); target IA is rooms in `BUSINESS_PLANT_PFD.md` | High | When working on Content, Metrics, Automate, or legacy stage code |
| *(Future)* `ARCHITECTURE.md` | System design, data model, key decisions   | Medium   | When touching core systems |
| `PROCESS.md` | Process mapping contract schema (4.2) | Medium | When implementing PROCESS.md, templates, or agent prompt contracts |
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