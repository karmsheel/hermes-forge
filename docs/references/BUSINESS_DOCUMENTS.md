# Business Documents / Knowledge — Design Reference

> **Status:** Implemented foundation (backlog **4.18**).  
> Durable markdown knowledge for a business — sibling to `PROCESS.md`, not a generic wiki.

## Purpose

Hermes Forge maps **how work runs** (processes) and is growing into **manage the business**. Documents hold durable narrative context Hermes cannot invent from a single process chat:

- Purpose, values, goals, problems solved  
- Customers / users  
- Market landscape  
- Strategy (living narrative — not the same as discrete Decisions)  
- Freeform imports (markdown the owner already wrote)

**Core loop:** talk to Hermes → extract durable facts → persist as documents → inject as context when mapping workflows, strategizing, or using the global chatbar.

## Product rules

| Rule | Detail |
|------|--------|
| Business-scoped | Every document belongs to one `Business` |
| Markdown-first | `bodyMarkdown` is the source of truth for content |
| Pin for context | `pinnedForContext` controls default Hermes injection (always include Basics when present) |
| Not PROCESS.md | Process-mapping contract stays generated in `PROCESS.md` |
| Not Decisions | Decisions = discrete choices; Strategy docs = living prose |
| Not a CMS | No folder trees, collab, or binary office formats in v1 |
| Agent-native | Viewer + editor; Hermes proposes/applies via chat tools later |

## Document kinds (v1)

| Kind | Slug seed | Role |
|------|-----------|------|
| `basics` | `basics` | Purpose, values, goals, problems solved, positioning |
| `customers` | `customers` | Segments, JTBD, pains |
| `market` | `market` | Competitors, landscape, constraints |
| `strategy` | `strategy` | Bets, priorities, non-goals |
| `freeform` | derived from title | Imports + blank notes |

Seeded on business create (and lazily via `ensureBusinessDocuments` for existing businesses): **basics**, **customers**, **market**, **strategy** with section headings.

## Data model

```text
BusinessDocument
  id, businessId
  title, kind, slug          # slug unique per business
  bodyMarkdown
  pinnedForContext           # default inject into Hermes
  sortOrder
  source                     # seed | import | manual | hermes
  createdAt, updatedAt
```

## Runtime locations

| Path | Role |
|------|------|
| `lib/documents.ts` | Kinds, seed templates, slug, prompt addon, ensure seed |
| `app/api/documents/**` | List / create / get / patch / delete / import |
| `app/(shell)/documents/page.tsx` | List + markdown viewer / editor |
| `lib/diagram.ts` | Inject pinned docs into process chat system prompt |
| `lib/chatbar/page-snapshot-server.ts` | Documents page snapshot for global chatbar |
| `lib/business-git/materialize.ts` | Writes `documents/{slug}.md` + `documents/index.json` |
| `lib/business-log-types.ts` | `document.created` / `document.updated` / `document.deleted` |

## Hermes injection

**Process chat:** pinned documents (and always `basics` if it exists) are truncated and appended near `PROCESS.md` in `buildChatSystemPrompt`.

**Studio chatbar:** `/documents` page blurb + server snapshot lists titles, kinds, pin state, and a short preview of the selected/pinned docs. Full-body edits via Hermes tools are a follow-up.

## Git materialize layout

```text
documents/
  index.json          # id, title, kind, slug, pinnedForContext, updatedAt
  basics.md
  customers.md
  ...
```

## Non-goals (v1)

- PDF / DOCX as first-class formats  
- Hierarchical folders / wiki graph  
- Auto-writing every chat turn into a document  
- Multi-user collaborative editing  
- Merging strategy docs into `BusinessDecision`
