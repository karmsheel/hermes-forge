# Living business map — multi-level twin

Canonical model for the **business graph** and room views. Complements [`PRODUCT_VISION.md`](PRODUCT_VISION.md) (north star) and [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) (soft unlock / room chrome baseline).

**Status:** Aligned to product vision (2026-07-25).  
**Implementation tracker:** [`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md) **§ Phase 8** (8.0–8.15).  
**Storage:** Local-first `Business.graphJson` (SQLite). No centralized cloud graph store. Blockchain storage is a **future** option only.

---

## 1. Hierarchy

| Level | Node kind | User language | Primary room |
|-------|-----------|---------------|--------------|
| L0 | `unit` | Unit / function / area | Foundation |
| L1 | `capability` | Capability / channel / practice | Foundation → Map |
| L2 | `process` | Process | Map |
| L3 | `step` | Step | Map (structured graph SoT) |
| Later | metric, automation, document, owner | — | Monitor / Automate |

**Contains** edges form the tree. **flows_to** / **feeds** form networks.

Legacy mapping:

- `BusinessFunction` → seed `unit` nodes  
- `Process` + `department` → seed `process` under unit; Mermaid remains **legacy display only**  
- New process depth = **step nodes**, not Mermaid SoT  

---

## 2. Rooms → graph views

| Room | Subgraph | MVP |
|------|----------|-----|
| Foundation | Units, capabilities, high-level flows / I/O | Yes |
| Map | Process + step graphs under a capability | Yes |
| Forge (improve) | Same graph + recommendations | Deferred |
| Monitor | Metrics attached to nodes | Deferred |
| Automate | Automations on **steps** | Deferred |
| Operate | Live status overlays | Deferred |

Workshop Mermaid: **frozen** for legacy processes only.

### Mermaid freeze (Phase 8.7)

| Concern | Policy |
|---------|--------|
| Process depth SoT | **Step graph** on `graphJson` (Map → Steps) |
| Workshop | Remains for processes with existing `diagramMermaid` |
| Plant “Mermaid tiles” view | **Legacy only** — demoted label; compact plant is default |
| Export bridge | `exportProcessStepsToMermaid` — Copy Mermaid from Map Steps (share, not authoring) |
| Import Mermaid → steps | Optional later; **not** MVP |
| New Mermaid-as-SoT features | **Do not** ship |

Code markers: `lib/mermaid-policy.ts`, `lib/business-graph/export-mermaid.ts`.

---

## 3. Canvas stack

| Layer | Runtime |
|-------|---------|
| Foundation + Map structural views | `@xyflow/react` |
| Process internals (new) | Step graph on xyflow |
| Process internals (legacy) | Mermaid Workshop (no new SoT features) |
| Mermaid export | Step graph → flowchart string (bridge only) |
| Freeform whiteboards | Out (tldraw paid; Excalidraw sketch-first) |

Closed node types only — standard maps across businesses.

---

## 4. Graph document

Persisted on `Business.graphJson` as:

```json
{
  "version": 1,
  "nodes": [{ "id", "kind", "name", "parentId?", "props?", "position?" }],
  "edges": [{ "id", "kind", "fromId", "toId", "label?" }]
}
```

See `lib/business-graph/` for types, validation, applyPatch, seed-from-legacy, xyflow projectors.

---

## 5. Conversation loop

```
Talk → AI proposes patch → Canvas shows change → Approve → Persist → Expand
```

Agent fences (direction): `forge-graph` ops for units/capabilities/processes/steps (extend `plant-apply` pattern).

---

## 6. Implementation sequence

1. Graph core + API + seed from functions/processes  
2. Foundation xyflow unit/capability view  
3. Map step-graph view  
4. Overlord propose/apply patches  
5. Post-MVP: Forge / Monitor / Automate / Operate  

---

## 7. Decision log

| Date | Decision |
|------|----------|
| 2026-07-25 | L0–L3: unit → capability → process → step |
| 2026-07-25 | graphJson local-first; blockchain later; no centralized SaaS store |
| 2026-07-25 | Step graph SoT; Mermaid legacy freeze |
| 2026-07-25 | xyflow for structural maps |
| 2026-07-26 | 8.7: demote plant Mermaid tiles; step→Mermaid export bridge; policy module |

---

**End of LIVING_BUSINESS_MAP.md**
