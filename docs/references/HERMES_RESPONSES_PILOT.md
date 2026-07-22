# Hermes Responses / Sessions pilot — agent implementation brief

> **Backlog:** 4.19 residual · **Plan Task 8** (optional)  
> **Status:** Not started (as of 2026-07-22)  
> **Priority:** P1 efficiency / architecture — **not** required for unified chatbar “done”  
> **Audience:** Future implementer (Grok / Claude / human). Read this whole file before coding.

---

## 0. How to load this in a worktree

```powershell
git show main:docs/references/HERMES_RESPONSES_PILOT.md
# or
.\scripts\get-reference.ps1 HERMES_RESPONSES_PILOT.md
```

Also load:

| File | Why |
|------|-----|
| `docs/references/HERMES_API_SERVER.md` | Capability audit, Tier C, inefficiencies |
| `docs/references/upstream/hermes-api-server.md` | Upstream API wording (do not edit) |
| `docs/references/GLOBAL_CHATBAR.md` | Chatbar architecture after 4.19 |
| `docs/superpowers/plans/2026-07-22-unified-global-chatbar.md` § Task 8 | Original checklist |
| `docs/superpowers/specs/2026-07-22-unified-global-chatbar-design.md` § Tier C | Design intent |
| `AGENTS.md` | Worktree + commit rules |

---

## 1. One-paragraph summary

Forge interactive chat still uses **stateless Chat Completions** (`POST /v1/chat/completions`): every studio turn rebuilds system + page context + up to ~80 history messages and sends the full `messages[]`. Hermes also exposes a **Responses API** (`POST /v1/responses`) that can keep tool-inclusive history **server-side** via `previous_response_id` or a named `conversation`. **Task 8** is a **flagged pilot** on **studio** turns only: adopt Responses (or Sessions as alternative), measure **prompt token reduction**, document results, and keep Chat Completions as the default until the pilot proves value.

---

## 2. Why this exists (problem)

From `HERMES_API_SERVER.md` §4.1:

- Studio chat rebuilds large system + page + knowledge envelopes every turn.
- Client re-sends full history → higher **cost**, **latency**, and risk that Hermes compaction diverges from what Forge thinks is “in context.”
- Dual-mode context meter already prefers **last-turn Hermes usage** when present; with Responses, local transcript length **no longer equals** prompt size — meter must trust Hermes usage more.

**Not in scope of Task 8:** UI unity (done in Tasks 0–7, 9), Workshop process map features, approvals, skills catalog.

---

## 3. What Hermes provides (upstream facts)

Re-fetch upstream if dates drift. Snapshot: `docs/references/upstream/hermes-api-server.md` (fetched 2026-07-21).

### 3.1 `POST /v1/responses`

- OpenAI Responses-style API.
- **Server-side history** via:
  - `previous_response_id` (chain to prior `resp_…`), or  
  - named `conversation` string (server chains to latest in that conversation).
- Request can include `input` (string or structured parts), `instructions` (system-like layering), `store: true`, model id (cosmetic).
- Response includes `id` (store this as previous), `output[]` (may include `function_call` / `function_call_output` + assistant message), `usage` with **`input_tokens` / `output_tokens` / `total_tokens`**.
- Streaming uses Responses event types (`response.created`, `response.output_text.delta`, `response.output_item.added`, `response.completed`, etc.) — **not** Chat Completions chunks. Forge’s `streamHermesEvents` / `drainOpenAiSseBufferEvents` today assume chat.completions.

### 3.2 Storage limits

- Max **~100** stored responses (LRU), SQLite-persisted across gateway restarts.
- Long Forge threads that only chain `previous_response_id` may **evict** old links → 404 / broken chain → must **fallback** to full Chat Completions (or re-seed Responses with full history).

### 3.3 Headers (already used by Forge on chat routes)

| Header | Forge builder | Pilot requirement |
|--------|---------------|-------------------|
| `X-Hermes-Session-Key` | `buildHermesSessionKey` → `forge:{userId}:{businessId}:{agentProfileKey\|default}` | **Keep** on Responses requests (Honcho / long-term memory scope) |
| `X-Hermes-Session-Id` | `buildHermesSessionId` → `forge-conv:{conversationId}` | **Keep** for transcript correlation |
| `Authorization: Bearer` | Existing hermes config | Same as today |

Source: `lib/chatbar/session-headers.ts` (Task 2 shipped).

### 3.4 Alternative: Sessions API

`POST /api/sessions/{id}/chat` and `…/chat/stream` — Hermes-managed sessions with fork/list/messages.

- Forge already has a **Foundation → Sessions** UI path that **proxies** list/create/get/patch/delete/messages/fork/chat (`app/api/hermes/sessions/*` may exist on some branches; studio conversations remain separate).
- Sessions are a **second** pilot path. Prefer **Responses** first for studio threads unless Sessions mapping is cleaner for your branch.
- Do **not** force 1:1 map of every Forge `Conversation` to a Hermes session unless product explicitly wants dual sources of truth.

---

## 4. Current Forge architecture (do not break)

### 4.1 Default path today

```text
ChatbarPanel (client)
  → POST /api/studio/conversations/[id]/chat  (SSE)
      → builds system + page context + history
      → streamHermesEvents → POST {base}/v1/chat/completions  stream:true
      → SSE events: user, receipt, run_id, tool, usage, delta, done, …
```

Key files:

| Path | Role |
|------|------|
| `lib/hermes-stream.ts` | `streamHermesEvents` → **hardcoded** `/v1/chat/completions` |
| `lib/hermes.ts` | `callHermes` / `callHermesWithMeta` non-stream completions |
| `lib/chatbar/usage.ts` | Normalize `prompt_tokens` / `input_tokens` etc. |
| `lib/chatbar/session-headers.ts` | Session-Key / Session-Id |
| `app/api/studio/conversations/[id]/chat/route.ts` | Studio + `kind=process` branch |
| `lib/chatbar/process-chat-turn.ts` | Process turn runner (completions) |
| `lib/chatbar/automation-chat-turn.ts` | Automation design turn (completions) |
| `prisma` `Conversation` | `kind: process \| studio`, **no** `previousResponseId` column yet |

### 4.2 Product rules (non-negotiable)

1. **Forge DB is UI source of truth** — messages, titles, forks, export, decisions stay in Prisma. Hermes Responses state is a **runtime optimization**, not the product history store.
2. **Chat Completions remains default** until pilot flag is on and measured.
3. **Pilot studio only** (`Conversation.kind === "studio"`). Do not switch Workshop process or automation design until studio results are good.
4. **No dual permanent chat UI** — still one `ChatbarPanel` tree (4.19 Task 9).
5. **Session-Key isolation** — never drop Session-Key when switching transport (memory bleed across businesses is an explicit risk in the design doc).

---

## 5. Implementation goals

### 5.1 Must ship

1. Feature flag (default **off**): e.g. env `FORGE_HERMES_RESPONSES_PILOT=1` and/or developer setting / localStorage `forge.hermes.responsesPilot=1`.
2. New module e.g. `lib/hermes-responses.ts`:
   - Build Responses request body from instructions + latest user input (+ optional seed history on first turn).
   - Stream or non-stream consume → assistant text + usage + **response id**.
   - Map Hermes usage into `NormalizedHermesUsage` (reuse `lib/chatbar/usage.ts`).
3. Persist **`previousResponseId`** per Forge conversation (see §6 storage).
4. Wire **only** studio branch of `app/api/studio/conversations/[id]/chat/route.ts` when flag on.
5. On chain failure (404, eviction, missing id): **fallback** to full Chat Completions and optionally clear stored id + reseed.
6. Metrics: log or write a short table comparing **prompt/input tokens** for N multi-turn exchanges (flag on vs off). Document in `HERMES_API_SERVER.md`.
7. Keep stop / abort working (AbortController at minimum; run_id/stop if Responses exposes run ids — verify live Hermes version).

### 5.2 Should ship

- Unit tests for request builders, id persistence helpers, fallback logic (mock fetch).
- Capability probe: only enable UI/flag path if `/v1/capabilities` advertises `responses_api` (or equivalent) when features list is non-empty.
- Developer Settings toggle for easier desktop QA.

### 5.3 Nice to have (defer)

- Named `conversation: forge-studio:{conversationId}` instead of (or in addition to) `previous_response_id`.
- Process / automation cutover.
- Full Responses SSE parity for tool activity strip (may need new stream parser).
- `Idempotency-Key` on submit.

### 5.4 Explicit non-goals

- Replacing Prisma message history with Hermes-only storage.
- Deleting Chat Completions path.
- Multi-agent parallel docks.
- Waiting on `#15618` live context_tokens (meter still uses last-turn usage + estimate).

---

## 6. Storage design for `previousResponseId`

`Conversation` today has no metadata column. Pick **one**:

### Option A — JSON column (recommended for pilot)

```prisma
// Conversation
hermesRuntime Json?  // { "previousResponseId": "resp_…", "transport": "responses", "updatedAt": "…" }
```

- No separate table; easy to clear on “New chat” / fork.
- On **fork**, do **not** copy previousResponseId (new branch must reseed or use Completions until first Responses turn).

### Option B — dedicated columns

```prisma
hermesPreviousResponseId String?
hermesTransport          String?  // "completions" | "responses"
```

### Option C — side table

`ConversationHermesState(conversationId, previousResponseId, …)` — overkill for pilot.

**Lifecycle:**

| Event | Action |
|-------|--------|
| First studio turn with flag on | Call Responses with full instructions + optional `conversation_history` / rich `input` seed; store returned `id` |
| Subsequent turns | Send **delta** user input + `previous_response_id`; store new `id` |
| Chain broken / 404 / empty | Clear id; fall back to Completions; optionally next turn reseed Responses |
| User starts new studio thread | New Conversation row → no id |
| Fork conversation | New row; **null** previousResponseId |
| Flag off | Ignore stored id; Completions only |

---

## 7. Prompt / context strategy under Responses

Today Completions path sends **full** system + page envelope every turn. Under Responses:

**Recommended pilot shape:**

1. **First turn (seed):**  
   - `instructions` = same system builders as catalog (`lib/chatbar/prompt-catalog.ts` / studio prompt builders).  
   - `input` = user text, optionally with a compact context receipt if product requires “what page am I on.”  
   - Or pass initial history if Hermes supports `conversation_history` on Responses (verify against live docs).

2. **Later turns:**  
   - Prefer **short** `input` = new user message only.  
   - **Page context changes** (user navigates rooms): either  
     - inject a system-style note in `input` / `instructions` for that turn (“Page context update: …”), or  
     - force Completions for that turn, or  
     - reseed Responses with fresh instructions (costs more once).  
   - Do not silently drop page-context protocol; design for `contextMode` follow-page vs chat-only.

3. **Settings Agent prompts** must still describe reality: if Responses path uses shorter re-sends, document that in catalog notes after pilot.

---

## 8. Streaming & tool UX

| Concern | Completions today | Responses pilot |
|---------|-------------------|-----------------|
| Text deltas | `choices[].delta.content` | `response.output_text.delta` (verify) |
| Tool strip | `hermes.tool.progress` + tool_calls normalize | Spec-native `function_call` items — may need new parser |
| Usage | chunk/final + run poll | `usage` on completed response |
| Stop | AbortController + `/v1/runs/{id}/stop` | Abort + check if Responses yields run_id |

**Pilot:** Pilot may start **non-stream** or stream-with-text-only to reduce risk, then add tool-strip parity. Product still expects tool activity when possible — note any regression in pilot docs.

---

## 9. Suggested implementation steps

1. **Read** live Hermes docs + hit `GET /v1/capabilities` on a running gateway; confirm `responses_api` / endpoints.
2. **Spike** curl: one Responses create + second turn with `previous_response_id`; capture usage.
3. **Add** `lib/hermes-responses.ts` (+ tests) with flag helper `isHermesResponsesPilotEnabled()`.
4. **Persist** previousResponseId (migration if column/json).
5. **Branch** studio chat route: if flag && kind=studio → Responses path; else existing Completions.
6. **Fallback** hard on errors.
7. **Measure** 5–10 multi-turn studio chats (with page context) flag on vs off; record median `input_tokens` / `prompt_tokens`.
8. **Update** `HERMES_API_SERVER.md` matrix (`POST /v1/responses` column) + this doc’s §11 results.
9. **Commit** message (from plan):  
   `feat: optional Hermes Responses API pilot for studio chat`

Do **not** enable flag by default without measurement write-up.

---

## 10. Acceptance criteria (pilot)

- [ ] Flag off → byte-for-byte behavior of current Completions path (no regression).
- [ ] Flag on, studio only → multi-turn works; assistant text + DB messages still correct.
- [ ] `previousResponseId` stored and reused; fork/new chat do not corrupt chains.
- [ ] Session-Key and Session-Id still set on Hermes calls.
- [ ] Fallback to Completions on chain failure without hanging the UI.
- [ ] Usage still reaches chatbar meter (SSE `usage` or done payload).
- [ ] Written comparison in `HERMES_API_SERVER.md` (tokens / qualitative latency).
- [ ] Process + automation paths untouched by default.

---

## 11. Measurement template (fill after pilot)

| Scenario | Completions median input/prompt tokens | Responses median input_tokens | Notes |
|----------|----------------------------------------|-------------------------------|--------|
| 5-turn studio, chat-only | | | |
| 5-turn studio, follow-page | | | |
| Tool-heavy turn | | | |
| After 100+ response LRU pressure | | | |

**Decision after pilot:**

- **Promote** (flag default on for studio) / **Keep opt-in** / **Abandon** (document why).

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Response LRU (100) breaks long threads | Fallback to Completions; optional reseed; document limit |
| Stream event format differs | New parser or non-stream pilot first |
| Page context drift | Explicit context-update turns or reseed |
| Double history (client + server) | On Responses path do **not** re-send full 80 messages after seed |
| Memory bleed | Always set Session-Key; never share previousResponseId across businesses/agents |
| Tool strip regression | Keep Completions for process; document studio gaps |
| Large PR | Flag + studio-only + Completions fallback |

---

## 13. Related code pointers (as of Task 9 ship)

```
lib/hermes-stream.ts          # Completions stream client — do not delete
lib/hermes.ts                 # Non-stream Completions
lib/chatbar/usage.ts          # Normalize usage fields
lib/chatbar/session-headers.ts
lib/chatbar/prompt-catalog.ts # Same builders for Settings + chat
app/api/studio/conversations/[id]/chat/route.ts
components/chatbar/ChatbarPanel.tsx  # Client SSE consumer
prisma/schema.prisma          # Conversation model
```

Upstream raw:  
https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/user-guide/features/api-server.md

---

## 14. Commit / branch hygiene

- Prefer worktree: `git worktree add ../hermes-forge-responses-pilot -b feature/hermes-responses-pilot`
- Load references via `git show main:docs/references/...`
- Small PR: flag + client helper + studio route branch + migration + docs
- Do not commit `dist/`, secrets, or ephemeral measurement scripts unless useful under `scripts/`

---

## 15. Original plan excerpt (Task 8)

From `docs/superpowers/plans/2026-07-22-unified-global-chatbar.md`:

```text
### Task 8: Responses/Sessions pilot (HERMES Tier C optional)

Files:
- lib/hermes-responses.ts (new)
- Feature flag; studio-default pack only
- Store previousResponseId on conversation metadata JSON or column

- Step 1: Behind flag, use POST /v1/responses with previous_response_id
  for studio turns; measure token reduction via usage.
- Step 2: Document results in HERMES_API_SERVER.md.
- Step 3: Commit
  feat: optional Hermes Responses API pilot for studio chat
```

Dependency: after Task 1 usage plumbing + Task 2 session headers (both **shipped**). Independent of UI unity (Tasks 5–7, 9 **shipped**).

---

**End of brief.** When implementation starts, update §11 and `HERMES_API_SERVER.md` in the same PR as the pilot code.
