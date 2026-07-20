# Workshop Forged Actions — Design Spec

**Date:** 2026-07-20  
**Status:** Approved for implementation planning  
**Backlog relationship:** Workshop post-forge UX; aligns with Phase 5 Map → Monitor → Automate and Phase 6 soft unlock (`lifecycleStatus === forged`).

---

## 1. Problem

After a process is **forged** in Workshop, the header only offers **Open in Automations**. Users need clear next steps for the operating loop:

1. Reopen the map for editing (**Unforge**) when safe  
2. Instrument the business (**Attach Measurement** → Monitor)  
3. Design / view automations (**Automate**)

There is no human-facing unforge path today. Metrics are business-level (no `processId` on `BusinessMetric`). Automation studio is 1:1 with process and may exist in design-only form without a live deploy.

---

## 2. Goals

| Goal | Success signal |
|------|----------------|
| Three explicit options when forged | Header shows **Unforge**, **Attach Measurement**, **Automate** (Approach 1) |
| Unforge when safe | Status → `draft`, `approvedAt` cleared; agents can edit again |
| Block unforge when live | Deployed/live automation blocks with clear error |
| Measurement entry | Navigate to Monitor metrics; no schema change |
| Automate entry | Navigate to automations list |
| Symmetric API | Dedicated unforge endpoint mirrors `/forge` |

### Non-goals

- Process-linked metrics (`BusinessMetric.processId`)  
- Creating a metric from Workshop  
- Deep-link into `/automations/[processId]` from this control set  
- Deleting design-only Automation rows on unforge  
- Changing soft-unlock chrome for rooms (Monitor/Automate already unlock on any forged process)

---

## 3. Decisions (locked)

| Topic | Decision |
|-------|----------|
| UI approach | **Approach 1** — three equal header actions next to the Forged pill |
| Attach Measurement | **A** — navigate to `/metrics` (optional `?fromProcess=<id>`; no binding) |
| Automate | **B** — navigate to `/automations` list |
| Unforge gate | Block only if automation is **deployed/live**; design-only does not block |

---

## 4. UI

### Location

`components/workshop/WorkshopSession.tsx` — process diagram header row (right of title / Forged pill).

### Visibility

| Process state | Header CTAs |
|---------------|-------------|
| Draft / refined + diagram, can forge | **Forge process** (existing primary) |
| Forged / approved | **Unforge** · **Attach Measurement** · **Automate** |
| Split available | **Split** remains independent (existing) |

Replace the current **Open in Automations** link with the three actions above. Keep the green **Forged** pill.

### Control style

- All three: `btn-secondary` (or equivalent), `text-xs`, icon + label — same weight as today’s secondary header buttons.  
- **Unforge:** e.g. unlock / rotate icon; not primary orange. Optional subtle danger hover is fine; no full destructive styling required.  
- **Attach Measurement:** chart / activity icon.  
- **Automate:** existing Zap-style affordance; green text optional for continuity with current link.  
- Narrow viewports: allow wrap (`flex-wrap`) so actions remain visible.

### Labels (exact)

1. **Unforge**  
2. **Attach Measurement**  
3. **Automate**

### Interactions

**Unforge**

1. User clicks **Unforge**.  
2. Confirm dialog (browser `confirm` or existing app confirm pattern if one exists in workshop):  
   > Reopen this process as draft? Agents can edit the map again.  
3. On confirm → `POST /api/processes/[id]/unforge`.  
4. Success → refresh process + list; toast: process reopened as draft.  
5. Failure (409 live automation) → toast with server message; stay forged.  
6. Optional client pre-check: if process summary already exposes deploy status as live, disable Unforge with `title` tooltip explaining the block (server remains source of truth).

**Attach Measurement**

- Client navigation/link to `/metrics?fromProcess=<processId>`.  
- `fromProcess` is optional metadata for future UX; Metrics page need not read it in v1.  
- Does not create metrics or change Monitor unlock logic.

**Automate**

- Client navigation/link to `/automations`.  
- Replaces **Open in Automations**.

---

## 5. Server: Unforge

### Endpoint

`POST /api/processes/[id]/unforge`

Symmetric to `POST /api/processes/[id]/forge`.

### Auth

`requireProcessAccess` — human owner/session only (same as forge). Agents must not unforge via this route.

### Live automation definition

An automation for the process is **deployed/live** when it exists and is considered deployed by existing deploy-status helpers, specifically:

- Prefer reusing `automationStatusToDeployStatus` (or equivalent):  
  - **Live / blocking:** `deployed_cron` | `deployed_n8n`  
  - **Also block if** `externalId` is set and status indicates a live runtime (including paused/failed live jobs that still have an external deploy) — practical rule: **`Boolean(automation.externalId)`** is the primary gate used at deploy time; align with `automationStatusToDeployStatus` so `needs_credentials` with an external id is treated as live enough to block unforge.  
- **Non-blocking:** no Automation row, or row with no `externalId` and design statuses (`designing`, `not_started`, `ready_to_deploy` without deploy).

**Canonical rule for implementers:**

```text
block if automation exists AND automation.externalId is non-null/non-empty
```

This matches “deployed / live” without treating a pure studio draft as a lock.

### Happy path

1. Load process; ensure status is forged (normalize legacy `approved`).  
2. Load Automation by `processId` if any; apply live gate.  
3. Update process: `status: 'draft'`, `approvedAt: null`.  
4. Record decision (kind reflecting unforge / lifecycle reopen) and business log event.  
5. Return `{ process }`.

### Errors

| Condition | HTTP | Body |
|-----------|------|------|
| Not found / no access | 401/403/404 | existing auth patterns |
| Not forged | 400 | e.g. `Process is not forged` |
| Live automation | **409** | `code: 'AUTOMATION_LIVE'`, human message: pause/remove live automation before unforging |
| Other | 400 | message |

### Logging

- Add `PROCESS_UNFORGED` (or `process.unforged`) to `BUSINESS_EVENT_TYPES` if not present; summary like `Unforged process "…"`.  
- Decision record parallel to forge (title/statement: owner reopened process as draft).  
- Do not delete Automation, messages, or metrics.

### Helper

`unforgeProcessDirect({ businessId, userId, processId })` in `lib/decisions/service.ts` (or adjacent lifecycle module), called from the route — mirrors `forgeProcessDirect`.

### PATCH status

Existing `PATCH /api/processes/[id]` with `status: draft` may still exist for other flows. Prefer the dedicated unforge route for the Workshop button so the live gate is centralized. Optionally apply the same live gate if PATCH is used to leave forged (nice-to-have, not required for v1 if only the button uses POST unforge).

---

## 6. Client state

After successful unforge:

- `activeProcess` status becomes draft; Forged pill → Draft.  
- Three actions hide; **Forge process** returns when `canForgeProcess` is true.  
- Process sidebar status badge updates via list reload.

No change to chatbar process session binding beyond status-driven agent mutation rules already in place.

---

## 7. Testing

| Case | Expect |
|------|--------|
| Forged, no automation | Unforge succeeds → draft |
| Forged, design-only automation | Unforge succeeds → draft |
| Forged, automation with `externalId` | Unforge 409; remains forged |
| Draft process | Unforge 400 |
| UI forged | Three buttons; no Open in Automations; no Forge CTA |
| Attach Measurement / Automate | Correct hrefs |

Unit: pure helper for “is automation live” if extracted.  
Manual: Workshop forge → three options → metrics/automations links; unforge with/without deploy.

---

## 8. Files (expected touch set)

| Area | Path |
|------|------|
| UI | `components/workshop/WorkshopSession.tsx` |
| API | `app/api/processes/[id]/unforge/route.ts` (new) |
| Service | `lib/decisions/service.ts` (+ optional `lib/process-status` or small unforge helper) |
| Log types | `lib/business-log-types.ts` |
| Tests | unit for live gate + optional route/service tests under `tests/unit/` |

No Prisma migration.

---

## 9. Acceptance criteria

- [ ] When process is forged, Workshop header shows **Unforge**, **Attach Measurement**, **Automate** as three peer secondary actions.  
- [ ] **Attach Measurement** goes to `/metrics` (optional `fromProcess` query).  
- [ ] **Automate** goes to `/automations`.  
- [ ] **Unforge** confirms, then reopens as draft when no live deploy; blocked with clear message when `externalId` is set.  
- [ ] Design-only automation does not block unforge.  
- [ ] Business log / decision recorded on unforge.  
- [ ] Forge CTA returns after unforge when diagram present.  
- [ ] `npm run build` (or project unit tests for new helpers) passes.

---

## 10. Open items (none blocking)

None. `fromProcess` is intentionally unused by Metrics UI in v1.
