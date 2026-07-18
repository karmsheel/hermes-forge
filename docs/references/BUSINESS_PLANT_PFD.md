# Business plant PFD & Forge rooms

Canonical Phase 6 product model for Hermes Forge: **rooms of the Forge**, progressive unlock, plant metaphor, and Map as process flow diagram (PFD).

**Status:** Locked product decisions (2026-07-16). Implementation tracked in [`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md) § Phase 6 (items **6.0–6.7**).

**Related:** Phase 5 stages (`lib/forge-stage.ts`) are the **shipping baseline**; this doc defines the **target IA** that 6.6 / 6.7 implement. Prefer this doc over ad-hoc stage copy when room UX conflicts with “Map | Monitor | Automate as peer modes.”

---

## 1. North-star metaphor

A business is a **designed plant**.

| Metaphor | Product meaning | User-facing language |
|----------|-----------------|----------------------|
| Plant | The whole business as one connected system | “Business”, “how work moves” |
| Unit operation | One mapped process | “Process”, “shape” |
| Stream / transfer | Process-to-process link | “Connected processes”, “flow” |
| PFD | Overview diagram of the plant | Map room canvas (not “PFD” in chrome) |
| Forge | The product as a physical place | “Hermes Forge”, room names |

**Do not** require chemical-engineering literacy in UI copy. Metaphor guides design; chrome stays plain (“Shape”, “Flow”, “Connected processes”).

---

## 2. Rooms of the Forge

The Forge is a **place**. Work happens in **rooms**. The top control is a **room switcher**, not a maturity pipeline labeled “stages.”

| Room | Role | Primary surface (target) |
|------|------|---------------------------|
| **Foundation** | Intake / plant sketch. Talk first; shapes, draft processes, and documents appear. | `/foundation` + shell chat |
| **Map** | See and work the business as a plant. | **Promoted plant canvas** (ex–God Mode compact + links) |
| **Monitor** | Instrument what was forged. | Metrics / content health |
| **Automate** | Agents, jobs, automation studio for forged maps. | Automations |

### Always available (not rooms)

- Business switcher / business manager  
- Log, Decisions  
- Settings, profile  
- Shell chat (global chatbar)  
- Personnel where product already requires hire gates  

### Workshop is not a room

**Workshop** is a **tool inside the Map room** — the forge bench for one unit operation (full Mermaid, process chat, forge lifecycle).

- Route `/workshop` may remain.  
- IA: open from Map plant (click shape / process), or process deep-link (“continue mapping”).  
- Do **not** present Workshop as a peer room next to Foundation / Map / Monitor / Automate.

### Functions

Org / department view of the **same map**, not a separate philosophy. Secondary layout or list mode under Map; not a competing “home of Map.”

### God Mode

**Promoted into Map** as the primary plant canvas. Exit pure dev-gate for product use once re-homed. Dev-only extras (if any) stay under Developer settings; the plant overview itself is Map.

---

## 3. Agents & naming

| Concept | User-facing | Notes |
|---------|-------------|-------|
| Foundation room | **Foundation** | Always the room name in chrome |
| Foundation co-pilot | **Overlord** | Agent identity / persona in Foundation chat context — **not** a room name (formerly Underlord) |
| Map / Monitor / Automate | Same labels | Room names; evolve Phase 5 “stage” copy toward “room” |
| Process lifecycle | draft → refined → **forged** | Gate for Monitor / Automate unlock |

**Rejected / mistranslations:** “Quartermaster” is **not** a room or agent name (speech-to-text error). Do not reintroduce it.

**Code note:** `ForgeStage` / `StageExplorer` may keep stage ids short-term; user-facing strings and new docs should say **room**. Prefer `forge-room` renames when touching the module for 6.6/6.7.

---

## 4. Progressive unlock (soft locks)

**Center room switcher hides locked rooms** so new users only see **Foundation** (business picker + dotted bridge + single tab). Map appears once seeded; Monitor / Automate appear after forge. Locks remain **soft for routes**: no hard 404s; deep links still work and show unlock criteria + CTA (not a fake empty product).

| Room | Soft-unlock when | Chrome + locked behavior |
|------|------------------|--------------------------|
| **Foundation** | Business exists | Always in switcher; **default for new / thin businesses** |
| **Map** | ≥1 process (draft stub counts) | Hidden until ready; then appears after Foundation. Deep link: empty state → “Talk in Foundation to seed processes” |
| **Monitor** | ≥1 process with `lifecycleStatus === "forged"` | Hidden until forged; then appears with Map. Deep link: SoftRoomLock + “Forge a process in Map / Workshop” |
| **Automate** | ≥1 **forged** process | Same as Monitor for chrome + deep-link soft lock |

**Footer tools (Log, Decisions) never lock.**

**Hard locks are out of scope.** Power users may open locked routes; content is guidance, not a silent full UI over zero data.

### Unlock detection (implementation hint)

- Map ready: `Process` count for active business ≥ 1  
- Monitor / Automate ready: exists process where `lifecycleStatus === "forged"` (or `approvedAt` set if legacy compat)  
- Prefer server-backed readiness (API / foundation overview) over client-only guesses when gates affect chrome  

---

## 5. User journey (locked story)

```text
New business
  → Foundation (Overlord + chat)
  → shapes / draft processes / docs appear
  → Map soft-unlocks when first process exists

Map
  → plant canvas (promoted God Mode compact + process links)
  → open process → Workshop (tool)
  → forge at least one process
  → Monitor + Automate soft-unlock

Monitor / Automate
  → if opened early: soft-lock empty state + “Forge a process first”
  → if unlocked: real operating UIs
```

**Emotional arc:** *I described the business → it appeared as a plant → I forged one unit → more wings of the Forge opened.*

---

## 6. Entry & Home (6.7)

| Business state | Default landing |
|----------------|-----------------|
| New / thin (no or few processes; early docs only) | **Foundation** |
| Mature (has processes; optional last-room restore) | **Map** or last room |
| Process deep-link / continue mapping | **Workshop** (Map tool) |

**Home dissolves into Foundation for new businesses.** The product Home lobby is not the primary first room.

**Deferred:** each subsequent room gets its own unique homepage (Map home, Monitor home, Automate home). Not specified in this doc; do not block 6.6/6.7 on designing them.

**Do not:** break desktop multi-tab session restore ([`DESKTOP_MULTI_TAB_SHELL.md`](DESKTOP_MULTI_TAB_SHELL.md)) or business isolation.

---

## 7. Map room = plant PFD (6.6)

### Primary surface

God Mode–style **compact plant canvas** + **process-to-process links**, re-homed as the Map room’s main view (ungated for product use).

### What Map owns

- I/O shapes + process nodes  
- Process-to-process links (plant edges)  
- Drill-in to Workshop  
- Path to **forge** (draft → refined → forged) so Monitor/Automate unlock  

### Fidelity split

| Surface | Fidelity |
|---------|----------|
| **Foundation** | Low-fidelity plant **sketch** while talking (drafts, docs, early shapes) |
| **Map** | Working plant as processes exist and links form |
| **Workshop** | High-fidelity single unit op |

### 6.6 deliverables (phased wow)

**First wow (implement with room model):**
1. Visible plant of draft + real processes on Map  
2. Links between processes  
3. Click shape → Workshop → forge  
4. God Mode plant promoted into Map (exit pure dev-gate as Map primary)  

**Trail (same milestone, can follow):**
- ~~Layout modes: by function | by flow | manual~~ **Done**  
- ~~External plant feeds/products (business-level I/O framing)~~ **Done** — Map **Outside I/O** (entry inputs / exit outcomes)  
- ~~Export plant view (PNG/SVG/PDF) alongside per-process export~~ **Done** — Map compact `PlantExportMenu` / `lib/export-plant.ts`
- Preserve pan/zoom context when drilling into Workshop  

### Success criteria

- User describing their business in Foundation ends with a **visible plant of draft blocks**  
- Opening any block yields Workshop path to a **realistic process map**  
- Linked processes show **end-to-end flow** on one canvas  
- Metaphor holds for designers; users never need the word “PFD”  

---

## 8. Relationship to Phase 5 stages

Phase 5 shipped **Map | Monitor | Automate** as equal stage filters (`StageExplorer`, `STAGE_NAV_IDS`).

**Target:** same three operating rooms **plus Foundation as a first-class room**, with **soft progressive unlock**, and Map’s default surface = plant PFD (not Functions-first).

| Phase 5 (baseline) | Target (this doc) |
|--------------------|-------------------|
| Stages as peer modes | Rooms of the Forge; progressive open |
| Map default → Functions / Foundation | Map primary → plant canvas; Foundation is its own room |
| God Mode dev-gated | God Mode plant → Map primary |
| All stages always choosable | Soft-lock Monitor/Automate until forged |
| Workshop as Map nav item | Workshop as Map tool only |

Content inventory, metrics, and automations **stay** under Monitor / Automate; only chrome and gates change.

---

## 9. Shape library & links (shipped foundations)

### I/O shapes (`Process.ioShape`)

| ID | Meaning |
|----|---------|
| `siso` | Single in, single out |
| `simo` | Single in, multi out |
| `miso` | Multi in, single out |
| `mimo` | Multi in, multi out |

See backlog **6.1**. UI label: **Shape**.

### Process links (`ProcessLink`)

Directed edges between processes in one business. See backlog **6.5**.

**Partial:** Hermes may propose links verbally; user draws edges. Auto tool-call creation is not required for first wow.

---

## 10. Implementation order (when coding)

Agreed sequence for 6.6 + 6.7 after this reference:

1. **IA + unlock** — room switcher (from stage explorer), soft-lock states, forged gate — **Done**  
2. **Entry (6.7)** — new / thin business → Foundation; template starters seed Foundation drafts — **Done** (hard Home dissolve deferred)  
3. **Map plant (6.6)** — promote God Mode canvas into Map; Workshop as drill-in tool — **Done**  
4. **Copy** — Overlord identity in Foundation; unlock tooltips; soft-lock empty states — **Done** (baseline)  

5. **Polish** — progressive chrome; mature last-room restore  

### Explicitly deferred (do not expand into)

- Integrations page (4.5), n8n expansion (5.5), external connectors (5.6)  
- Windows code signing (4.16)  
- Per-room unique homepages  
- Hard locks  
- ~~Full plant export / outside I/O framing~~ shipped under 6.6 trail

---

## 11. Non-goals

- Requiring users to learn plant/PFD vocabulary  
- Replacing Workshop deep-map (Phase 2/3 stays; entry path changes)  
- Hard-gating routes with 404s  
- Renaming Foundation room to Overlord or Quartermaster  
- Building Monitor/Automate room homepages in the first implementation pass  
- Treating Function org chart as the long-term Map primary over the plant canvas  

---

## 12. Concept flow

```text
Foundation (Overlord)
    │  chat → docs + draft shapes + seed processes
    ▼
Map (plant PFD)
    │  links + click unit op
    ▼
Workshop (tool)
    │  refine Mermaid → forge
    ▼
Monitor + Automate soft-unlock
```

---

## 13. Decision log

| Date | Decision |
|------|----------|
| 2026-07-15 | Phase 6 vision: plant metaphor, Foundation entry, I/O shapes, links, God Mode → plant |
| 2026-07-16 | Rooms (not stages as peer modes); unlock on **forged**; soft locks |
| 2026-07-16 | Room name **Foundation**; Foundation agent **Underlord** *(superseded 2026-07-18 → Overlord)* |
| 2026-07-16 | Workshop = tool inside Map |
| 2026-07-16 | Home dissolves into Foundation for new business; room-specific homepages later |
| 2026-07-16 | Promote God Mode into Map as primary plant surface |
| 2026-07-16 | Prioritize 6.6 + 6.7 wow; defer integrations and code signing |
| 2026-07-18 | Foundation co-pilot renamed **Underlord → Overlord** (Forge Overlord) |
| 2026-07-18 | App-wide Forge Overlord setup (spawn or existing Hermes profile) before Business Manager; remove forced per-business first hire; changeable later via profile |


---

**End of BUSINESS_PLANT_PFD.md**
