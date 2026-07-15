# PROCESS.md — Contract schema

Per-business process mapping contract for Hermes Forge (backlog **4.2**).

## Purpose

`PROCESS.md` is the Open Design–style **standards contract** for process work:

- Gives Hermes agents a durable overview of the business, actors, systems, and anti-patterns
- Is written into the per-business Git materialize tree as `PROCESS.md`
- Is injected (truncated) into workshop chat system prompts

It is **generated** from live SQLite state (`lib/process-md.ts`). Users shape it indirectly via business profile, personnel roster, discovery answers, and chat — not by editing the markdown file in the app (yet).

## Schema sections

| Section | Source |
|---------|--------|
| **Overview** | Business name, description, industry, goals, constraints |
| **Notation** | Process standard tag on processes (`auto`, `bpmn-lite`, `swimlane`, `flowchart`) |
| **I/O shapes** | Closed library: `siso` / `simo` / `miso` / `mimo` (Phase 6.1 black-box interface) |
| **Actors** | Human personnel + hired Hermes agent profiles |
| **Systems** | Discovery fields + known tool names inferred from process text |
| **Processes** | List of mapped processes with function, status, I/O shape, trigger, I/O |
| **Plant links** | Directed process-to-process edges (Phase 6.5) |
| **Anti-patterns** | Built-in defaults (split independent triggers, no invented systems, etc.) |
| **Export format** | Markdown SOP, Mermaid, PNG, PDF, Cursor bundle |

## Runtime locations

| Path | Role |
|------|------|
| `lib/process-md.ts` | Build + prompt snippet helpers |
| `lib/business-git/materialize.ts` | Writes root `PROCESS.md` on Git export |
| `lib/diagram.ts` → `buildChatSystemPrompt` | Injects contract into chat |
| `docs/references/PROCESS.md` | This schema reference |

## Example (abbreviated)

```markdown
# PROCESS.md — Acme Operations

## Overview
Wholesale ops for regional distribution.

## Notation
- **Default:** Swimlane (`swimlane`)

## I/O shapes
- `siso` (→ □ →) — Single in, single out
- `simo` (→ □ ⇉) — Single in, multi out
- `miso` (⇉ □ →) — Multi in, single out
- `mimo` (⇉ □ ⇉) — Multi in, multi out

## Actors
- **Jordan Lee** — Owner
- **Ops Agent** — Hermes agent

## Systems
- Shopify
- Slack

## Processes
### Order fulfillment
- **Function:** Operations
- **Status:** mapping
- **I/O shape:** `siso` (→ □ →) — Single in, single out
- **Trigger:** New paid order

## Plant links
- **Order intake** → **Order fulfillment**
- **Order fulfillment** → **Invoicing**

## Anti-patterns
- Do not map multiple independent triggers into a single workflow — split them.

## Export format
Markdown SOP, Mermaid source, PNG diagram, PDF diagram, Cursor agent bundle.
```

## Future

- Editable PROCESS.md in Settings / Business manager
- Persist overrides on `Business` (optional column) instead of pure generation
- Round-trip import from Git snapshot
