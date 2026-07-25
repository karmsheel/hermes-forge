# Hermes Forge — Product Vision

**Hermes Forge isn’t building software for businesses. It’s building businesses into software.**

An AI-native **business operating system** that turns conversation into a **single living business graph** (digital twin). The twin grows in fidelity as the business is understood, improved, measured, automated, and operated.

**Status:** Locked product intent (2026-07-25). Implementation evolves the existing desktop/local-first app in place.  
**Related:** [`LIVING_BUSINESS_MAP.md`](LIVING_BUSINESS_MAP.md) (levels + canvas), [`BUSINESS_PLANT_PFD.md`](BUSINESS_PLANT_PFD.md) (rooms/unlock baseline), [`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md) **§ Phase 8** (implementation tracker — split work here).

---

## 1. Black box

Every business starts as a black box:

```
Inputs → [ Business ] → Outputs
```

**Typical inputs:** owner’s time, employees, capital, equipment, knowledge, materials.  
**Typical outputs:** revenue, profit, customers, assets, business knowledge.  
Some outputs (profit) reinvest — feedback loops for growth.

Hermes Forge **progressively reveals** what is inside the box through conversation and structured modeling.

---

## 2. Principles

- Model **businesses**, not software systems.
- Reflect **reality before automation**.
- Work for offline and digital businesses.
- Encourage continuous improvement.
- AI is a **collaborator**, not only an automation engine.
- **One living graph**; rooms are views of the same objects.
- **Conversation-first** — users never begin by drawing diagrams.
- **Local-first storage** (SQLite / device). No centralized cloud storage providers (Firebase/Supabase/etc.) as product backbone. Future option: **blockchain-backed** storage — not MVP.

---

## 3. The business graph

Everything references the same graph. There are not separate automation, monitoring, or documentation models.

```
Business
  └── Business Units
        └── Capabilities
              └── Processes
                    └── Process Steps
                          ├── Automations   (post-MVP)
                          ├── Metrics       (post-MVP)
                          ├── SOPs / Knowledge / Documents
                          └── Owners
```

### Progressive decomposition (example)

| Level | Content |
|-------|---------|
| 1 | Business |
| 2 | Sales, Marketing, Operations, Finance, Product |
| 3 | Under Marketing: Twitter, LinkedIn, Newsletter, SEO, Referrals |
| 4 | Under Twitter: Research → Draft → Review → Publish → Measure |

Decomposition continues indefinitely. AI expands; user reviews/approves; repeat.

### Edge kinds (core)

| Kind | Meaning |
|------|---------|
| `contains` | Hierarchy (unit contains capability, process contains step) |
| `flows_to` | Handoff / sequence / dependency |
| `feeds` | Input/output streams at system boundary |

Later: `measures`, `automates`, `owned_by`.

---

## 4. Rooms

| Room | Purpose | MVP? |
|------|---------|------|
| **Foundation** | High-level model from conversation (units, capabilities, dependencies, I/O) | **Yes** |
| **Map** | Break capabilities into **structured process step graphs** | **Yes** |
| **Forge** | Improve: bottlenecks, SOPs, KPIs, alternatives (consultant) | Deferred |
| **Monitor** | Metrics on graph nodes | Deferred |
| **Automate** | Execution on **steps** (Hermes skills, n8n, MCP, human, APIs) | Deferred |
| **Operate** | Live operational twin (status by unit/capability) | Deferred |

**Forge room** is distinct from process lifecycle status “forged” and from the product name. Lifecycle copy may later become “approved/ready” to avoid confusion.

**Workshop + Mermaid:** legacy path only. **Source of truth for new maps is the structured step graph** (xyflow). Mermaid may remain as optional export / bridge for old processes (**freeze** — do not extend Mermaid as SoT).

---

## 5. AI-first workflow

```
User conversation
  → AI understands business
  → Graph ops proposed
  → User reviews on canvas
  → User approves
  → AI expands further
  → Repeat
```

Manual graph edit is **review and refine**, not blank-canvas authoring.

### Advisors (post-MVP)

Specialized advisors (CEO, Ops, Marketing, Finance, Automation, Product) reason over the graph: goals, bottlenecks, metrics, history, capacity.

### Business branching (post-MVP)

Versioned experiments on the twin (e.g. newsletter cadence A vs B) before commit.

---

## 6. Automation philosophy

```
Reality → Mapped → Measured → Improved → Automated → Operated → Continuously optimized
```

Automation is a **result of understanding**, not the objective.

---

## 7. Technology (this product)

| Concern | Choice |
|---------|--------|
| Data | **Local-first SQLite** + Prisma; `Business.graphJson` property graph document |
| Future storage | Optional **blockchain** persistence — research later; skip centralized SaaS backends |
| Frontend | React + Next.js (existing) |
| Graph UI | **@xyflow/react** |
| Layout | Existing plant-layout + hierarchical layout; ELK.js optional later |
| AI | Hermes Agent (BYOK / local) |
| Process depth SoT | Structured **step nodes**; Mermaid export optional / legacy freeze |

---

## 8. MVP scope

Prove the core loop only:

1. Conversational onboarding  
2. AI-generated high-level graph  
3. Progressive decomposition units → capabilities  
4. Expand into structured process step graphs  
5. Manual edit of the graph  
6. Persistent local graph storage  
7. **Foundation + Map** rooms  

**Do not** ship in first MVP cut: Monitor productization, Automate attach, Operate, Advisors, branching, Forge consultant room.

**Success:** A real business becomes a durable, editable structured model through talk + review.

---

## 9. Decision log

| Date | Decision |
|------|----------|
| 2026-07-25 | Full vision locked (black box → rooms → graph hierarchy) |
| 2026-07-25 | Local-first only; no Firebase/Supabase; blockchain storage option later |
| 2026-07-25 | Evolve Hermes Forge in place (not greenfield rewrite) |
| 2026-07-25 | MVP = Foundation + Map; Forge/Monitor/Automate/Operate deferred |
| 2026-07-25 | Step graph SoT; Mermaid frozen as legacy / optional export |
| 2026-07-25 | Canvas: xyflow; tldraw/Excalidraw not primary |

---

**End of PRODUCT_VISION.md**
