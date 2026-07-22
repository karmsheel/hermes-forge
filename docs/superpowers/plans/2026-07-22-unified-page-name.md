# Unified Page Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every AppTopBar shell page shows its page name in one place — left-aligned directly under the business picker — with no duplicate large/compact page-name headers in page bodies.

**Architecture:** A pure `pageNameFromPath` map is the single source of truth. Shell renders one `PageName` strip under `AppTopBar` (using active forge-tab route when multi-tab is on). Home room badges and list/tool page titles are removed; entity chrome (process name, stats, actions) stays.

**Tech Stack:** Next.js App Router, React client shell, CSS in `app/globals.css`, Node test runner (`node --test` via `npm test` / direct path).

**Design:** `docs/superpowers/specs/2026-07-22-unified-page-name-design.md`

## Global Constraints

- Page name is **shell-owned** — pages must not reintroduce under-picker badges or large page-name `h1`s.
- Position: **under business picker**, **left-aligned** to picker left edge (`1.25rem` inset, same as `.app-topbar__inner`).
- Typography: small uppercase, wide tracking, muted, semibold (generalize home badge styles).
- Out of scope for rendering: `/business-manager`, `/setup/*` (no AppTopBar).
- Multi-tab: resolve path like NavRail — `activeTab.route` when tabs enabled, else `usePathname()`.
- Keep Workshop process name, automation process name, and data stats; those are entity chrome, not page names.
- Do not change Business Manager title, auth screens, or Overlord setup.
- Prefer small commits per task.

---

## File map (target)

| Path | Responsibility |
|------|----------------|
| `lib/page-name.ts` | `pageNameFromPath(path): string \| null` — canonical route → label |
| `tests/unit/page-name.test.ts` | Unit coverage for map + fallbacks |
| `components/shell/PageName.tsx` | Presentational label (`id="shell-page-name"`) |
| `components/shell/AppShell.tsx` | Mount strip under `AppTopBar`; path resolution |
| `app/globals.css` | `.shell-page-name` + strip; remove/stop using `.home-page__room-badge` |
| `package.json` | Register `page-name.test.ts` in `test` script |
| `components/home/HomeHero.tsx` | Remove local room badge |
| `components/home/HomeCombined.tsx` | Remove local room badge |
| List/studio pages | Remove large title blocks (keep useful body intros/actions) |
| Tool surfaces | Remove page-name-only header chrome |

---

### Task 1: `pageNameFromPath` (TDD)

**Files:**
- Create: `lib/page-name.ts`
- Create: `tests/unit/page-name.test.ts`
- Modify: `package.json` (`scripts.test` — append `tests/unit/page-name.test.ts`)

**Interfaces:**
- Produces: `pageNameFromPath(pathname: string): string | null`
- Consumes: `ROOM_HOME_COPY` / `ROOM_HOME_ROUTES` from `lib/room-home.ts` and `lib/forge-stage.ts` (reuse roomBadge strings; do not hardcode home labels twice)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/page-name.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageNameFromPath } from "../../lib/page-name.ts";
import { ROOM_HOME_COPY } from "../../lib/room-home.ts";

describe("pageNameFromPath", () => {
  it("returns room home badges for room home routes", () => {
    assert.equal(pageNameFromPath("/home"), ROOM_HOME_COPY.foundation.roomBadge);
    assert.equal(pageNameFromPath("/"), ROOM_HOME_COPY.foundation.roomBadge);
    assert.equal(pageNameFromPath("/inventory/home"), ROOM_HOME_COPY.inventory.roomBadge);
    assert.equal(pageNameFromPath("/map/home"), ROOM_HOME_COPY.map.roomBadge);
    assert.equal(pageNameFromPath("/monitor/home"), ROOM_HOME_COPY.monitor.roomBadge);
    assert.equal(pageNameFromPath("/automate/home"), ROOM_HOME_COPY.automate.roomBadge);
  });

  it("returns stable nav labels for primary shell routes", () => {
    assert.equal(pageNameFromPath("/home-combined"), "Home Combined");
    assert.equal(pageNameFromPath("/foundation"), "Foundation");
    assert.equal(pageNameFromPath("/god-mode"), "Plant");
    assert.equal(pageNameFromPath("/functions"), "Functions");
    assert.equal(pageNameFromPath("/workshop"), "Workshop");
    assert.equal(pageNameFromPath("/workshop?processId=abc"), "Workshop");
    assert.equal(pageNameFromPath("/personnel"), "Personnel");
    assert.equal(pageNameFromPath("/personnel/hire"), "Personnel");
    assert.equal(pageNameFromPath("/personnel/academy"), "Personnel");
    assert.equal(pageNameFromPath("/documents"), "Documents");
    assert.equal(pageNameFromPath("/metrics"), "Metrics");
    assert.equal(pageNameFromPath("/content"), "Content");
    assert.equal(pageNameFromPath("/automations"), "Automations");
    assert.equal(pageNameFromPath("/automations/proc_1"), "Automations");
    assert.equal(pageNameFromPath("/automation-analysis"), "Automation Analysis");
    assert.equal(pageNameFromPath("/cronalytics"), "Cronalytics");
    assert.equal(pageNameFromPath("/decisions"), "Decisions");
    assert.equal(pageNameFromPath("/log"), "Business log");
  });

  it("returns null for full-bleed / excluded routes", () => {
    assert.equal(pageNameFromPath("/business-manager"), null);
    assert.equal(pageNameFromPath("/setup/overlord"), null);
    assert.equal(pageNameFromPath("/login"), null);
  });

  it("strips query strings before matching", () => {
    assert.equal(pageNameFromPath("/functions?x=1"), "Functions");
  });

  it("title-cases unknown first segment as fallback", () => {
    assert.equal(pageNameFromPath("/some-new-page"), "Some new page");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/page-name.test.ts
```

Expected: FAIL — cannot find module `../../lib/page-name.ts` (or similar).

- [ ] **Step 3: Implement `lib/page-name.ts`**

```ts
// lib/page-name.ts
import { ROOM_HOME_ROUTES } from "@/lib/forge-stage";
import { ROOM_HOME_COPY } from "@/lib/room-home";

/** Routes that never show the under-picker shell page name. */
const EXCLUDED_PREFIXES = ["/business-manager", "/setup", "/login", "/sign-in", "/signup"] as const;

/**
 * Canonical page name for shell chrome (under business picker).
 * Returns null when the route has no AppTopBar page-name slot.
 */
export function pageNameFromPath(pathname: string): string | null {
  const raw = (pathname || "/").split("?")[0] || "/";
  const path = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;

  for (const prefix of EXCLUDED_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return null;
  }

  // Room homes — use roomBadge from ROOM_HOME_COPY
  if (path === "/" || path === ROOM_HOME_ROUTES.foundation) {
    return ROOM_HOME_COPY.foundation.roomBadge;
  }
  if (path === ROOM_HOME_ROUTES.inventory) return ROOM_HOME_COPY.inventory.roomBadge;
  if (path === ROOM_HOME_ROUTES.map) return ROOM_HOME_COPY.map.roomBadge;
  if (path === ROOM_HOME_ROUTES.monitor) return ROOM_HOME_COPY.monitor.roomBadge;
  if (path === ROOM_HOME_ROUTES.automate) return ROOM_HOME_COPY.automate.roomBadge;

  if (path === "/home-combined") return "Home Combined";

  const prefixRules: { test: (p: string) => boolean; name: string }[] = [
    { test: (p) => p.startsWith("/foundation"), name: "Foundation" },
    { test: (p) => p.startsWith("/god-mode"), name: "Plant" },
    { test: (p) => p === "/functions" || p.startsWith("/functions/"), name: "Functions" },
    { test: (p) => p.startsWith("/workshop"), name: "Workshop" },
    { test: (p) => p.startsWith("/personnel"), name: "Personnel" },
    { test: (p) => p.startsWith("/documents"), name: "Documents" },
    { test: (p) => p.startsWith("/metrics"), name: "Metrics" },
    { test: (p) => p.startsWith("/content"), name: "Content" },
    { test: (p) => p.startsWith("/automations"), name: "Automations" },
    { test: (p) => p.startsWith("/automation-analysis"), name: "Automation Analysis" },
    { test: (p) => p.startsWith("/cronalytics"), name: "Cronalytics" },
    { test: (p) => p.startsWith("/decisions"), name: "Decisions" },
    { test: (p) => p.startsWith("/log"), name: "Business log" },
  ];

  for (const rule of prefixRules) {
    if (rule.test(path)) return rule.name;
  }

  // Fallback: first segment → readable label
  const seg = path.replace(/^\//, "").split("/")[0];
  if (!seg) return null;
  return seg
    .split("-")
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
```

Note: if `@/` imports fail under the unit test runner, mirror other unit tests — use relative imports in the **test** file only; production module may keep `@/` if the rest of `lib/` does. Prefer relative imports inside `page-name.ts` only if existing pure `lib/*` modules do that for tests; currently most `lib` files use `@/`. Check `tests/unit/forge-stage.test.ts` pattern (imports from `../../lib/...`). The implementation file uses `@/` like other app lib modules.

- [ ] **Step 4: Register test in package.json**

In `package.json` `scripts.test`, append a space-separated path:

```
tests/unit/page-name.test.ts
```

(keep the long existing list; add this entry).

- [ ] **Step 5: Run tests and verify pass**

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/page-name.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/page-name.ts tests/unit/page-name.test.ts package.json
git commit -m "feat: add pageNameFromPath for shell page labels"
```

---

### Task 2: Shell `PageName` strip + CSS

**Files:**
- Create: `components/shell/PageName.tsx`
- Modify: `components/shell/AppShell.tsx`
- Modify: `app/globals.css` (add `.shell-page-name` / strip; deprecate home badge absolute layout)

**Interfaces:**
- Consumes: `pageNameFromPath` from `lib/page-name.ts`; `useForgeTabs` active route; `usePathname`
- Produces: visible label under picker on all non-full-bleed AppTopBar layouts

- [ ] **Step 1: Create `PageName.tsx`**

```tsx
// components/shell/PageName.tsx
"use client";

import { usePathname } from "next/navigation";
import { pageNameFromPath } from "@/lib/page-name";
import { useForgeTabs } from "./ForgeTabProvider";

/**
 * Shell page name — left-aligned under the business picker.
 * Path follows multi-tab active route when tabs are enabled (same as NavRail).
 */
export function PageName() {
  const pathname = usePathname();
  const { enabled: tabsEnabled, activeTab } = useForgeTabs();
  const activePath =
    tabsEnabled && activeTab ? activeTab.route.split("?")[0]! : pathname || "/";
  const name = pageNameFromPath(activePath);

  if (!name) return null;

  return (
    <div className="shell-page-name-strip" aria-hidden={false}>
      <p id="shell-page-name" className="shell-page-name">
        {name}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Mount in `AppShell.tsx`**

In the **non-full-bleed** return of `AppShellFrame` (where `AppTopBar` is rendered), wrap content so the strip sits between top bar and outlet:

```tsx
// inside AppShellFrame non-full-bleed branch — workspace column
<div className="app-shell-layout__workspace">
  <AppTopBar />
  <PageName />
  <div
    className="app-shell-layout__content"
    aria-labelledby="shell-page-name"
  >
    <ForgeTabOutlet>{children}</ForgeTabOutlet>
  </div>
</div>
```

Add import:

```tsx
import { PageName } from "./PageName";
```

Do **not** mount `PageName` on the full-bleed branch (Business Manager / setup).

- [ ] **Step 3: Add CSS in `app/globals.css`**

Place near existing home badge / topbar rules. Replace the role of `.home-page__room-badge` with shell styles:

```css
/*
 * Shell page name — under business picker, left-aligned to picker inset.
 * Reserved strip so content never collides with the label.
 */
.shell-page-name-strip {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0.35rem 1.25rem 0.15rem;
  box-sizing: border-box;
  pointer-events: none;
}

.shell-page-name {
  margin: 0;
  padding: 0;
  max-width: 100%;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: left;
  color: var(--text-muted);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Legacy home badge: no longer used; keep rule inert or delete call sites */
.home-page__room-badge {
  display: none;
}
```

If deleting `.home-page__room-badge` entirely is cleaner after Task 3 removes JSX, delete the old absolute-positioned rule block instead of `display: none`.

Confirm left padding `1.25rem` matches `.app-topbar__inner` leading padding (`padding: 0 … 0 1.25rem`).

- [ ] **Step 4: Smoke-check layout classes**

Ensure full-height layouts still work:

- `.app-shell-layout--full` / `--home` content remains `flex: 1; min-height: 0`
- Strip is `flex: 0 0 auto` so it does not steal the whole column

No unit test for CSS; visual check in Task 5.

- [ ] **Step 5: Commit**

```powershell
git add components/shell/PageName.tsx components/shell/AppShell.tsx app/globals.css
git commit -m "feat: render shell PageName under business picker"
```

---

### Task 3: Remove home room badges

**Files:**
- Modify: `components/home/HomeHero.tsx`
- Modify: `components/home/HomeCombined.tsx`
- Modify: `app/globals.css` (remove obsolete `.home-page__room-badge` block if still present)

- [ ] **Step 1: HomeHero — delete badge**

In `HomeHero` return, remove:

```tsx
<p className="home-page__room-badge">{copy.roomBadge}</p>
```

Keep `copy` for hero title/subtitle only.

- [ ] **Step 2: HomeCombined — delete badge**

Remove:

```tsx
<p className="home-page__room-badge">Foundation · Home Combined</p>
```

- [ ] **Step 3: Delete dead CSS**

Remove `.home-page__room-badge { … }` (and any `display: none` stub from Task 2).

- [ ] **Step 4: Commit**

```powershell
git add components/home/HomeHero.tsx components/home/HomeCombined.tsx app/globals.css
git commit -m "refactor: drop local home room badges; shell owns page name"
```

---

### Task 4: Strip list/studio page-name headers

**Files (modify each):**
- `app/(shell)/functions/page.tsx`
- `app/(shell)/documents/page.tsx`
- `app/(shell)/content/page.tsx`
- `app/(shell)/metrics/page.tsx`
- `app/(shell)/log/page.tsx`
- `app/(shell)/decisions/page.tsx`
- `app/(shell)/personnel/layout.tsx`
- `app/(shell)/automation-analysis/page.tsx`
- `components/cronalytics/HeroBanner.tsx` (or cronalytics page if title only lives there)

**Rule per page:**
1. Remove uppercase eyebrow that only names room/stage/category **and** the large page-name `h1`.
2. Keep short intro `<p>` when it adds product guidance (without repeating the page name as a heading).
3. Keep action buttons (e.g. Functions “New function”) — restructure header row so actions remain without the big title.

- [ ] **Step 1: Functions**

Before (pattern):

```tsx
<div className="flex items-end justify-between mb-8 gap-4">
  <div>
    <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Map stage</div>
    <h1 className="text-3xl font-semibold tracking-tight">Functions</h1>
    <p className="text-sm text-text-muted mt-2 max-w-2xl">…</p>
  </div>
  <button …>New function</button>
</div>
```

After:

```tsx
<div className="flex items-start justify-between mb-8 gap-4">
  <p className="text-sm text-text-muted max-w-2xl">
    Business areas and workflows. Click a function to list its workflows; use Move to reassign
    a workflow to another function.
  </p>
  <button
    type="button"
    onClick={() => setNewOpen(true)}
    className="btn-primary text-sm shrink-0"
    disabled={!business}
  >
    <Plus className="w-4 h-4" />
    New function
  </button>
</div>
```

- [ ] **Step 2: Documents**

Remove eyebrow + h1 block; go straight to studio (optional: no intro exists beyond title — just remove the `mb-8` title div).

```tsx
<main className="mx-auto w-full max-w-6xl px-6 py-10">
  <DocumentsStudio businessId={currentBusiness?.id ?? null} />
</main>
```

- [ ] **Step 3: Content / Metrics**

Remove eyebrow + h1; keep intro `<p>` above studio.

Example Content:

```tsx
<main className="mx-auto w-full max-w-6xl px-6 py-10">
  <p className="mb-8 max-w-2xl text-sm text-text-muted">
    Pieces you ship — ideas, drafts, review, ready, shipped. Separate from
    Documents (business knowledge). Agents in Automate can draft on a
    schedule; review and mark status here.
  </p>
  <ContentStudio businessId={currentBusiness?.id ?? null} />
</main>
```

Metrics: same pattern (keep SoftRoomLock + MetricsStudio).

- [ ] **Step 4: Log / Decisions / Automation Analysis**

Same: drop eyebrow + page `h1`; keep description paragraph and body. For Decisions, drop the Scale icon from the removed h1 (icon was decorative on the title).

- [ ] **Step 5: Personnel layout**

```tsx
// non-forced-hire branch
return (
  <main className="max-w-4xl mx-auto px-6 py-10 w-full">
    <PersonnelSubnav />
    {children}
  </main>
);
```

Do **not** strip hire-page CTAs like “Hire your first agent” — those are flow titles, not shell page names.

- [ ] **Step 6: Cronalytics HeroBanner**

Remove the `Cronalytics` h1 (and “Hermes Plugin” eyebrow if it only frames the page name). Keep sync controls and description.

```tsx
// title block becomes description + actions only
<div>
  <p className="text-sm text-text-muted max-w-2xl">
    Cost and operational observability for your scheduled cron jobs. …
  </p>
</div>
```

- [ ] **Step 7: Commit**

```powershell
git add "app/(shell)/functions/page.tsx" "app/(shell)/documents/page.tsx" "app/(shell)/content/page.tsx" "app/(shell)/metrics/page.tsx" "app/(shell)/log/page.tsx" "app/(shell)/decisions/page.tsx" "app/(shell)/personnel/layout.tsx" "app/(shell)/automation-analysis/page.tsx" components/cronalytics/HeroBanner.tsx
git commit -m "refactor: remove list/studio page-name headers (shell owns labels)"
```

---

### Task 5: Strip tool-surface page-name chrome

**Files:**
- Modify: `components/foundation/FoundationRoom.tsx`
- Modify: `app/(shell)/god-mode/page.tsx`
- Modify: `components/workshop/WorkshopSession.tsx`
- Modify: `app/(shell)/automations/page.tsx`
- Modify: `app/(shell)/automations/[processId]/page.tsx` (only if header restates page name; keep process name)

- [ ] **Step 1: FoundationRoom**

Loaded header today:

- eyebrow `Foundation room · Overlord`
- h1 `Business foundations`
- stats line
- action buttons

After: keep stats + actions; drop page-name eyebrow/h1.

```tsx
<header className="shrink-0 border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
  <div className="min-w-0">
    <p className="text-xs text-text-muted truncate">
      {/* existing stats string only */}
    </p>
  </div>
  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
    {/* existing buttons */}
  </div>
</header>
```

Empty state “Foundation” centered h1: change to non-duplicate copy, e.g. keep as soft empty heading “Select a business” style already present in body text — prefer:

```tsx
<h2 className="text-xl font-semibold">No business selected</h2>
```

(or reuse existing helper copy without “Foundation” as page title).

- [ ] **Step 2: God Mode / Plant**

Remove header title block (`Map room` + `Plant`). Keep stats line if useful:

```tsx
<header className="shrink-0 border-b border-border px-6 py-2 flex items-center justify-between bg-bg">
  {stats.total > 0 ? (
    <p className="text-xs text-text-muted">
      {stats.total} process{stats.total !== 1 ? "es" : ""}
      …
    </p>
  ) : (
    <span />
  )}
</header>
```

If the header becomes empty when `stats.total === 0`, omit the entire header element.

- [ ] **Step 3: WorkshopSession**

Remove the top strip that only says `Workshop`:

```tsx
<header className="shrink-0 border-b …">
  <h1>Workshop</h1>
</header>
```

Keep the diagram header with process name (`Process Diagram` eyebrow + process name h1). Optionally demote process name from `h1` to `h2` if you want a single document h1 from shell — preferred:

```tsx
<div className="text-[10px] uppercase tracking-widest text-text-muted">
  Process Diagram
</div>
<p className="text-lg font-semibold tracking-tight">
  {loadingProcess ? "Loading..." : processName}
</p>
```

(shell `PageName` remains the page label; process name is entity chrome).

- [ ] **Step 4: Automations list**

Remove page-name from left of header (`Automate room` + `Automations`); keep Refresh button:

```tsx
<header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-end bg-bg">
  <button onClick={load} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1" disabled={!operateReady}>
    <RefreshCw className="w-3 h-3" /> Refresh
  </button>
</header>
```

- [ ] **Step 5: Automation detail**

Keep process name + Refresh (entity studio chrome). Change eyebrow from generic “Automation studio” only if it feels like a second page name — optional: drop eyebrow, keep process name as entity title (`p`/`h2`, not competing page h1).

- [ ] **Step 6: Commit**

```powershell
git add components/foundation/FoundationRoom.tsx "app/(shell)/god-mode/page.tsx" components/workshop/WorkshopSession.tsx "app/(shell)/automations/page.tsx" "app/(shell)/automations/[processId]/page.tsx"
git commit -m "refactor: remove tool-surface page-name headers"
```

---

### Task 6: Verification

**Files:** none new (run checks)

- [ ] **Step 1: Unit tests**

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/page-name.test.ts
```

Expected: PASS.

- [ ] **Step 2: Typecheck / build gate (pick one available)**

```powershell
npx tsc --noEmit
```

Or:

```powershell
npm run build
```

Expected: no new errors in touched files.

- [ ] **Step 3: Manual checklist (dev server)**

```powershell
npm run dev
```

Visit and confirm **page name under picker, left-aligned**, and **no second large page title**:

| Route | Expected label |
|-------|----------------|
| `/map/home` | Map home |
| `/home` | Foundation home |
| `/functions` | Functions |
| `/documents` | Documents |
| `/content` | Content |
| `/metrics` | Metrics |
| `/log` | Business log |
| `/decisions` | Decisions |
| `/personnel` | Personnel |
| `/foundation` | Foundation |
| `/god-mode` | Plant |
| `/workshop` | Workshop (+ process name in content) |
| `/automations` | Automations |
| `/business-manager` | No under-picker shell label |

Also: open a second desktop tab if available and confirm label tracks active tab route.

- [ ] **Step 4: Final commit only if verification fixes landed**

```powershell
git status
# if fixups: commit with message like "fix: page name strip spacing / a11y"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Under picker, left-aligned | Task 2 CSS + mount |
| Shell-owned map | Task 1 |
| Multi-tab active route | Task 2 `PageName` |
| Remove home badges | Task 3 |
| Remove list/studio large titles | Task 4 |
| Include Foundation / Workshop / Plant | Task 5 |
| Keep entity chrome (process name, stats, actions) | Tasks 4–5 rules |
| Exclude BM / setup | Task 1 null + Task 2 no mount on full-bleed |
| Reserved space (no overlay collision) | Task 2 strip |
| Unit tests | Task 1 + 6 |

## Placeholder / consistency notes

- Label strings match NavRail / `ROOM_HOME_COPY.roomBadge` (Home Combined uses short “Home Combined”, not “Foundation · Home Combined”).
- Function name is always `pageNameFromPath` (not `getPageTitle` / `resolvePageName`).
- CSS class is always `shell-page-name` / `shell-page-name-strip`.
