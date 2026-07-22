# Unified page name under business picker

**Date:** 2026-07-22  
**Status:** Approved  
**Scope:** Shell IA chrome — consistent page name placement across rooms  

## Problem

Page names are placed inconsistently across Hermes Forge:

| Pattern | Surfaces | Placement today |
|---------|----------|-----------------|
| Room badge | Room homes (`/map/home`, etc.) | Absolute under business picker; **centered** in picker width |
| Large page header | Functions, Documents, Content, Metrics, Log, Decisions, Personnel, Automations, … | Large `h1` + uppercase eyebrow in centered content column |
| Compact tool chrome | Foundation, Workshop, God Mode / Plant | Small title in full-bleed toolbar strip |

Users see the page name jump between top-left under the picker, mid-content large headings, and tool strips.

## Goal

On every shell page that has the room top bar + business picker, the **page name** appears in **one fixed position**:

- Directly **underneath the business picker**
- **Left-aligned** to the picker’s left edge (same horizontal inset as the picker)
- Same visual treatment everywhere

Large in-content page-name headers are **removed** (no duplicate titles).

## Non-goals

- Business Manager and setup (`/setup/*`) — full-bleed, no AppTopBar / business picker
- Settings / profile overlays
- Redesigning room switcher, nav rail, or multi-tab chrome
- Making page names dynamic (process name, business name) in this pass
- Full visual redesign of page body layouts beyond title removal / spacing cleanup

## Design decisions (approved)

### 1. Placement & visual style

- **Position:** Under the business picker, top of the content workspace column (below `AppTopBar`).
- **Alignment:** Left edge matches the business picker left edge (`app-topbar__inner` horizontal inset, currently `1.25rem`).
- **Typography:** Keep the existing home room-badge treatment:
  - Small uppercase, wide tracking, muted color, semibold
  - Left-aligned text (change from today’s centered-in-15rem home badge)
- **Layout:** Shell reserves vertical space for the label so page content never collides with it (not a free-floating absolute that overlays body content). Prefer a small reserved strip / padding-top on the content region, with the label sitting in that strip under the picker.

### 2. Architecture — shell-owned title

**Approach A (approved):** The shell owns the page name.

1. Add a canonical **route → page name** map (single source of truth).
2. Shell renders one shared **PageName** element from the active path (prefer active forge-tab route when multi-tab is enabled, consistent with NavRail highlight).
3. Pages **stop rendering** their own page-name chrome (large `h1`/eyebrow blocks and tool-header page titles).

**Title sources:**

| Route family | Page name |
|--------------|-----------|
| Room homes (`ROOM_HOME_ROUTES`, `/home`, `/home-combined`) | Existing `ROOM_HOME_COPY.roomBadge` (e.g. “Map home”) / Combined home label |
| Nav rail destinations | Match NavRail labels (Home is room-specific via badge above; Functions, Workshop, Plant, Documents, …) |
| Foundation `/foundation` | Foundation |
| God Mode `/god-mode` | Plant |
| Workshop `/workshop` | Workshop |
| Automations list + detail | Automations |
| Log, Decisions, Metrics, Content, Personnel, Cronalytics, etc. | Stable short names matching chrome |

Fallback for unmapped shell routes: derive a simple title from the first path segment, or omit the label only if truly full-bleed excluded routes.

**Out of scope for rendering:** `/business-manager`, `/setup/*` (no AppTopBar page-name slot).

### 3. Page cleanup

- **Remove** page-name `h1`s, uppercase eyebrows that only name the page/room, and compact tool-header titles that only restate the page name.
- **Keep** non-title UI: action buttons, process name (Workshop diagram header), stats that describe data (e.g. process counts), optional short body intro paragraphs when they add value **without** repeating the page name.
- **Workshop:** Under-picker name = “Workshop”. Process name remains in the diagram/session chrome (entity title, not page name).
- **Foundation / Plant:** Move page name to shell; keep stats/actions in body or a slim toolbar without a second page title.
- **Home:** Remove local `home-page__room-badge`; shell supplies the same string from the map / `ROOM_HOME_COPY`.

### 4. Accessibility

- Page name is exposed as a single accessible name for the main content region (e.g. `aria-labelledby` on main/content pointing at the PageName id, or a visually consistent element that is the document’s primary page label).
- Avoid multiple competing `h1`s: shell page name may be the sole top-level heading on list/studio pages; tool surfaces that still need an entity `h1` (process name) use a lower level or keep one content `h1` only for the entity.

### 5. Implementation sketch (not a full plan)

| Piece | Responsibility |
|-------|----------------|
| `lib/page-name.ts` (or similar) | `pageNameFromPath(path): string \| null` |
| `components/shell/PageName.tsx` | Presentational label + styles |
| `AppShell` / workspace column | Mount PageName under `AppTopBar` when not full-bleed-excluded |
| `globals.css` | Replace/generalize `.home-page__room-badge` → shell page-name class; reserved strip |
| Room home / list / tool pages | Delete duplicate title chrome; fix top padding |

## Success criteria

1. On every AppTopBar page, the page name sits under the business picker, left-aligned to the picker.
2. No second large page-name header appears in the body for the same route.
3. Home room badges and list/tool page names share one component and CSS.
4. Multi-tab: label tracks the **active tab’s route**, not a stale global path if they diverge.
5. Business Manager / setup unchanged (no under-picker label required).

## Open items for implementation plan

- Exact CSS: reserved strip height vs absolute-within-strip.
- Full inventory of routes and final strings (table in plan).
- Whether body intro paragraphs stay verbatim after title removal (per-page judgment during implementation).
- Unit test for `pageNameFromPath` coverage of primary routes.
