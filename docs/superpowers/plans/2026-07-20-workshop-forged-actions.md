# Workshop Forged Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Workshop process is forged, replace “Open in Automations” with three peer actions: Unforge, Attach Measurement, and Automate — with server-side unforge blocked only when automation is live (`externalId` set).

**Architecture:** Pure helper `isAutomationLiveDeployed` (externalId gate). `unforgeProcessDirect` in decisions service (mirrors forge). New `POST /api/processes/[id]/unforge` route. Workshop header UI swaps CTAs by lifecycle. No Prisma migration; no process-linked metrics.

**Tech Stack:** Next.js App Router, Prisma/SQLite, TypeScript, React client Workshop, node:test unit tests, sonner toasts, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-20-workshop-forged-actions-design.md`

## Global Constraints

- Labels exact: **Unforge**, **Attach Measurement**, **Automate**
- Attach Measurement → `/metrics?fromProcess=<processId>` (Metrics page need not read query in v1)
- Automate → `/automations` (list, not process studio)
- Live gate: block unforge iff `Boolean(automation?.externalId?.trim())`
- Design-only automation (no externalId) does **not** block unforge
- DecisionKind stays existing enum; unforge decision uses `kind: 'change'`
- Agents must not unforge via this route (human session via `requireProcessAccess` only)
- Do not delete Automation rows, messages, or metrics on unforge
- Follow existing forge route / `forgeProcessDirect` patterns
- Prefer small focused diffs; do not refactor unrelated workshop code

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/automation-types.ts` | Add `isAutomationLiveDeployed` pure helper |
| `lib/business-log-types.ts` | Add `PROCESS_UNFORGED: 'process.unforged'` |
| `lib/decisions/service.ts` | Add `unforgeProcessDirect` |
| `app/api/processes/[id]/unforge/route.ts` | POST unforge API |
| `components/workshop/WorkshopSession.tsx` | Header UI + client handler |
| `tests/unit/automation-live-deploy.test.ts` | Unit tests for live gate |
| `tests/unit/business-log-types.test.ts` | Assert new event type (optional small add) |
| `package.json` | Register new unit test file in `"test"` script |

---

### Task 1: Live-deploy gate helper + unit tests

**Files:**
- Modify: `lib/automation-types.ts` (append near `automationStatusToDeployStatus`)
- Create: `tests/unit/automation-live-deploy.test.ts`
- Modify: `package.json` (`"test"` script — append the new test path)

**Interfaces:**
- Consumes: none beyond existing automation shape
- Produces: `isAutomationLiveDeployed(automation: { externalId?: string | null } | null | undefined): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/automation-live-deploy.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAutomationLiveDeployed } from "../../lib/automation-types.ts";

describe("isAutomationLiveDeployed", () => {
  it("is false for missing automation", () => {
    assert.equal(isAutomationLiveDeployed(null), false);
    assert.equal(isAutomationLiveDeployed(undefined), false);
  });

  it("is false for design-only (no externalId)", () => {
    assert.equal(isAutomationLiveDeployed({ externalId: null }), false);
    assert.equal(isAutomationLiveDeployed({ externalId: "" }), false);
    assert.equal(isAutomationLiveDeployed({ externalId: "   " }), false);
    assert.equal(isAutomationLiveDeployed({}), false);
  });

  it("is true when externalId is set (live deploy)", () => {
    assert.equal(isAutomationLiveDeployed({ externalId: "job-123" }), true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/automation-live-deploy.test.ts
```

Expected: FAIL (export not found / is not a function).

- [ ] **Step 3: Implement helper**

In `lib/automation-types.ts`, after `automationStatusToDeployStatus`, add:

```ts
/** True when automation has been deployed externally (blocks process unforge). */
export function isAutomationLiveDeployed(
  automation: { externalId?: string | null } | null | undefined
): boolean {
  return Boolean(automation?.externalId?.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS (3 tests).

- [ ] **Step 5: Register test in package.json**

In `package.json` `"test"` script, append a space and:

`tests/unit/automation-live-deploy.test.ts`

after the other unit paths (keep one long line style consistent with the file).

- [ ] **Step 6: Commit**

```powershell
git add lib/automation-types.ts tests/unit/automation-live-deploy.test.ts package.json
git commit -m "feat: isAutomationLiveDeployed gate for unforge"
```

---

### Task 2: Business log event type + unforge service

**Files:**
- Modify: `lib/business-log-types.ts` — add `PROCESS_UNFORGED` next to `PROCESS_APPROVED`
- Modify: `lib/decisions/service.ts` — add `unforgeProcessDirect` after `forgeProcessDirect`
- Modify: `tests/unit/business-log-types.test.ts` — one assertion for the new type

**Interfaces:**
- Consumes: `isAutomationLiveDeployed` from `@/lib/automation-types`; `isProcessForged` from `@/lib/process-status`; existing `createDecisionRecord`, `recordBusinessEvent`, `liveOccurredNow`, `BUSINESS_EVENT_TYPES`
- Produces:
  - `BUSINESS_EVENT_TYPES.PROCESS_UNFORGED === 'process.unforged'`
  - `export class UnforgeProcessError extends Error { code?: string; status: number }` (or throw plain Error with message and a custom property — see implementation below)
  - `export async function unforgeProcessDirect(input: { businessId: string; userId: string; processId: string }): Promise<void>`

- [ ] **Step 1: Add event type**

In `lib/business-log-types.ts`, after `PROCESS_APPROVED`:

```ts
  PROCESS_APPROVED: 'process.approved',
  PROCESS_UNFORGED: 'process.unforged',
```

- [ ] **Step 2: Extend business-log unit test**

In `tests/unit/business-log-types.test.ts`, add:

```ts
  it("includes process.unforged for reopening forged maps", () => {
    assert.equal(BUSINESS_EVENT_TYPES.PROCESS_UNFORGED, "process.unforged");
    assert.equal(eventCategory(BUSINESS_EVENT_TYPES.PROCESS_UNFORGED), "process");
  });
```

- [ ] **Step 3: Implement `unforgeProcessDirect`**

Near the top of `lib/decisions/service.ts` (with other imports), ensure:

```ts
import { isAutomationLiveDeployed } from '@/lib/automation-types';
import { isProcessForged } from '@/lib/process-status';
```

(`BUSINESS_EVENT_TYPES` and prisma should already be imported.)

After `forgeProcessDirect`, add:

```ts
export class UnforgeProcessError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'UnforgeProcessError';
    this.status = status;
    this.code = code;
  }
}

/** Human reopens a forged process as draft (blocked when automation is live). */
export async function unforgeProcessDirect(input: {
  businessId: string;
  userId: string;
  processId: string;
}): Promise<void> {
  const process = await prisma.process.findFirst({
    where: { id: input.processId, businessId: input.businessId },
  });
  if (!process) throw new UnforgeProcessError('Process not found', 404);
  if (!isProcessForged(process.status)) {
    throw new UnforgeProcessError('Process is not forged', 400);
  }

  const automation = await prisma.automation.findUnique({
    where: { processId: process.id },
    select: { externalId: true },
  });
  if (isAutomationLiveDeployed(automation)) {
    throw new UnforgeProcessError(
      'Pause or remove the live automation before unforging this process.',
      409,
      'AUTOMATION_LIVE'
    );
  }

  await prisma.process.update({
    where: { id: process.id },
    data: { status: 'draft', approvedAt: null },
  });

  await createDecisionRecord({
    businessId: input.businessId,
    userId: input.userId,
    title: `Unforge process: ${process.name}`,
    statement: `Owner reopened process "${process.name}" as draft`,
    kind: 'change',
    relatedEntityType: 'process',
    relatedEntityId: process.id,
  });

  await recordBusinessEvent({
    businessId: input.businessId,
    userId: input.userId,
    type: BUSINESS_EVENT_TYPES.PROCESS_UNFORGED,
    entityType: 'process',
    entityId: process.id,
    entityName: process.name,
    summary: `Unforged process "${process.name}"`,
    ...liveOccurredNow(),
  });
}
```

- [ ] **Step 4: Run unit tests**

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/automation-live-deploy.test.ts tests/unit/business-log-types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/business-log-types.ts lib/decisions/service.ts tests/unit/business-log-types.test.ts
git commit -m "feat: unforgeProcessDirect with live automation gate"
```

---

### Task 3: Unforge API route

**Files:**
- Create: `app/api/processes/[id]/unforge/route.ts`

**Interfaces:**
- Consumes: `requireProcessAccess`, `unforgeProcessDirect`, `UnforgeProcessError`, `prisma`
- Produces: `POST` → `{ process }` on success; 400/404/409 on failure

- [ ] **Step 1: Create route** (mirror forge route)

Create `app/api/processes/[id]/unforge/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireProcessAccess } from '@/lib/auth';
import {
  UnforgeProcessError,
  unforgeProcessDirect,
} from '@/lib/decisions/service';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

/** Human reopens a forged process as draft documentation. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;

    await unforgeProcessDirect({
      businessId: result.process.businessId,
      userId: result.session.userId,
      processId: id,
    });

    const process = await prisma.process.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ process });
  } catch (error) {
    console.error('Unforge process error', error);
    if (error instanceof UnforgeProcessError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
        },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to unforge process',
      },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 2: Sanity-check TypeScript for the route (optional quick)**

If convenient:

```powershell
npx tsc --noEmit -p tsconfig.json 2>&1 | Select-String -Pattern "unforge"
```

Expected: no hits for unforge errors. Full project tsc may have pre-existing noise — only care about this route.

- [ ] **Step 3: Commit**

```powershell
git add app/api/processes/[id]/unforge/route.ts
git commit -m "feat: POST /api/processes/[id]/unforge"
```

---

### Task 4: Workshop header UI + client unforge handler

**Files:**
- Modify: `components/workshop/WorkshopSession.tsx`

**Interfaces:**
- Consumes: `POST /api/processes/${id}/unforge` via existing `apiFetch`; `Link` for metrics/automations
- Produces: when `isApproved`, three actions; `handleUnforgeProcess` handler

- [ ] **Step 1: Expand lucide imports**

Change:

```ts
import { CheckCircle2, Scissors, Zap } from "lucide-react";
```

to:

```ts
import { Activity, CheckCircle2, Scissors, Unlock, Zap } from "lucide-react";
```

- [ ] **Step 2: Add unforging state next to approving**

Find `const [approving, setApproving] = useState(false);` (or equivalent) and add:

```ts
const [unforging, setUnforging] = useState(false);
```

- [ ] **Step 3: Add handler after `handleApproveForAutomation`**

```ts
  async function handleUnforgeProcess() {
    if (!activeId || !activeProcess) return;
    const ok = window.confirm(
      "Reopen this process as draft? Agents can edit the map again."
    );
    if (!ok) return;
    setUnforging(true);
    try {
      const res = await apiFetch(`/api/processes/${activeId}/unforge`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unforge failed");
      }
      const data = await res.json();
      const updated = data.process ?? data;
      setActiveProcess((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadProcessList();
      toast.success("Process reopened as draft");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not unforge process"
      );
    } finally {
      setUnforging(false);
    }
  }
```

Note: the file uses `toast` via a local wrapper or `sonnerToast` — match the same toast helper used in `handleApproveForAutomation` (if it is `toast.success` / `toast.error` from a local `toast` object, keep that).

- [ ] **Step 4: Replace forged CTA block in the header**

Find the block:

```tsx
              {isApproved && (
                <Link
                  href="/automations"
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-green"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Open in Automations
                </Link>
              )}
```

Replace with:

```tsx
              {isApproved && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUnforgeProcess}
                    disabled={unforging}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    title="Reopen as draft so agents can edit again"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    {unforging ? "Unforging…" : "Unforge"}
                  </button>
                  <Link
                    href={`/metrics?fromProcess=${encodeURIComponent(activeProcess!.id)}`}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    title="Instrument this process in Monitor"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Attach Measurement
                  </Link>
                  <Link
                    href="/automations"
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-green"
                    title="Open Automations list"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Automate
                  </Link>
                </div>
              )}
```

Keep **Forge process** gated by `canApprove` (hidden when forged). Keep **Split** and Forged pill unchanged.

- [ ] **Step 5: Manual checklist (developer)**

With app running (`npm run dev` or desktop):

1. Open a process with diagram → **Forge process** → Forged pill + three buttons.  
2. **Attach Measurement** → `/metrics?fromProcess=…`.  
3. **Automate** → `/automations`.  
4. Unforge with no live automation → confirm → draft + Forge CTA returns.  
5. If possible: process with automation `externalId` set → Unforge → toast with live automation message; stays forged.

- [ ] **Step 6: Commit**

```powershell
git add components/workshop/WorkshopSession.tsx
git commit -m "feat: workshop forged actions Unforge, Measurement, Automate"
```

---

### Task 5: Verification

**Files:** none new (run only)

- [ ] **Step 1: Unit tests**

```powershell
npm test
```

Expected: all listed unit tests PASS (including `automation-live-deploy` and updated business-log types).

- [ ] **Step 2: Production build**

```powershell
npm run build
```

Expected: exit 0. Fix any TypeScript errors introduced by this work only.

- [ ] **Step 3: Final commit if verification needed fixups**

Only if Step 1–2 required code changes:

```powershell
git add <touched files>
git commit -m "fix: workshop forged actions verification fixes"
```

If clean, no extra commit.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Three header actions when forged | Task 4 |
| Labels Unforge / Attach Measurement / Automate | Task 4 |
| Attach Measurement → `/metrics?fromProcess=` | Task 4 |
| Automate → `/automations` | Task 4 |
| Unforge confirm + draft + clear approvedAt | Task 2 + 4 |
| Block when externalId set (409 + message) | Task 1 + 2 + 3 |
| Design-only does not block | Task 1 + 2 |
| Business log PROCESS_UNFORGED + decision record | Task 2 |
| POST `/api/processes/[id]/unforge` | Task 3 |
| No Prisma migration | (none) |
| Forge CTA returns after unforge | Task 4 (existing `canApprove`) |
| Unit tests for live gate | Task 1 |
| Build / test pass | Task 5 |

---

## Out of scope (do not implement)

- `BusinessMetric.processId` or Metrics page reading `fromProcess`
- Deep-link to `/automations/[processId]`
- Disabling Unforge button via client-side deploy status prefetch (optional nicety; server remains authoritative)
- Expanding `DecisionKind` with a dedicated `unforge` value
- Soft-unlock chrome changes for Monitor/Automate rooms
