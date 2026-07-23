# Hermes Agent API Server — Forge capability audit

> **Upstream source (canonical):**  
> https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md  
>
> **Raw markdown:**  
> https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/user-guide/features/api-server.md  
>
> **Local archive (snapshot):** [`upstream/hermes-api-server.md`](./upstream/hermes-api-server.md)  
> **Researched:** 2026-07-21 · **Forge status reconciled:** 2026-07-23  
> **Purpose:** What the Hermes API server exposes, how Forge uses it, context-window meter honesty, and residual gaps.

Re-fetch the upstream doc when re-auditing; capabilities move quickly. Keep this analysis updated when Forge adopts or deliberately skips a surface.

**P0 residual status (2026-07-23):** Interactive chat path is **shipped** for usage meter, stream parity, session headers, approvals, and unified chatbar (4.19 Tasks 0–7, 9). The only open **P1 architecture** item from the original sequence is the **Responses/Sessions pilot** (Task 8). Meter polish, skills/toolsets, and `/health/detailed` are **P2**. True remaining-window fill remains **blocked** on Hermes [#15618](https://github.com/NousResearch/hermes-agent/issues/15618).

---

## 1. What the API server is

Hermes exposes an **OpenAI-compatible HTTP API** (default `http://127.0.0.1:8642`) so any frontend can use the agent with its full toolset (terminal, files, web, memory, skills). Auth is **Bearer** `API_SERVER_KEY`. CORS is off by default (Forge talks **server-to-server**, which matches the recommended pattern).

Important limitations called out by upstream:

| Limitation | Implication for Forge |
|------------|------------------------|
| **`model` field is cosmetic** | Request `model` does not switch the underlying LLM. Real model is configured server-side (`config.yaml` / profile). Forge picker copy states this (tooltip: Hermes model / profile id). |
| **No file upload** via API | Images yes (inline `image_url` / `input_image`); arbitrary files/`file_id` → 400. |
| **Response storage cap** | `previous_response_id` chain: max **100** stored responses (LRU), SQLite-persisted across restarts. |
| **Chat Completions is stateless** | Client must send full `messages[]` each turn (still Forge default for interactive chat). |

---

## 2. Endpoint inventory vs Forge usage

Legend: ✅ used · 🟡 partial · ❌ not used · ⚠️ used differently than designed

| Endpoint | Upstream purpose | Forge today |
|----------|------------------|-------------|
| `POST /v1/chat/completions` | Stateless chat; SSE + `hermes.tool.progress`; **`usage` in non-stream JSON** | ✅ Core path. Studio + process + automation chat stream via `streamHermesEvents` and shared runners (`process-chat-turn.ts`, `automation-chat-turn.ts`). Usage from SSE and/or run poll. |
| `POST /v1/responses` | Responses API; server-side history via `previous_response_id` / named `conversation`; tool calls in `output[]`; **`usage`** | ❌ Unused. Pilot brief: [`HERMES_RESPONSES_PILOT.md`](./HERMES_RESPONSES_PILOT.md) (Task 8, not started). |
| `GET /v1/responses/{id}` | Fetch stored response | ❌ |
| `DELETE /v1/responses/{id}` | Delete stored response | ❌ |
| `GET /v1/models` | Advertise agent/profile as model id | ✅ Used for picker; only `id` kept — no context-length metadata. |
| `GET /v1/capabilities` | Feature discovery for UIs | ✅ Probe (`lib/hermes-connection.ts`); chatbar maps `run_stop`, `run_steer`, `run_approval`, … |
| `GET /health` | Liveness | ✅ |
| `GET /v1/health` | Same under `/v1` | 🟡 unused (alias) |
| `GET /health/detailed` | Authenticated readiness (counts, not secrets) | ❌ P2 — Settings “Hermes health” candidate |
| `POST /v1/runs` | Async run create (`run_id`) | 🟡 Stream-embedded run ids preferred; not explicit create |
| `GET /v1/runs/{id}` | Poll status + **`usage`** | ✅ Post-stream poll when usage missing from SSE (`fetchHermesRunUsage`) |
| `GET /v1/runs/{id}/events` | SSE tool progress / deltas / lifecycle | 🟡 Forge uses chat-completions stream events instead |
| `POST /v1/runs/{id}/stop` | Soft-cancel run | ✅ Chatbar stop |
| `POST /v1/runs/{id}/steer` | Steer active run | ✅ Capability-gated |
| `POST /v1/runs/{id}/approval` | Human approval for gated tools | ✅ `ChatbarApprovalModal` on `approval.request` → once / session / always / deny |
| Jobs `/api/jobs/*` | Cron/scheduled jobs CRUD + pause/run | ✅ Cronalytics / automation job surface |
| Sessions `/api/sessions/*` | List/create/fork/chat/stream Hermes sessions | 🟡 **Foundation → Sessions** (`/sessions`) via `/api/hermes/sessions/*` (list/create/get/patch/delete/messages/fork/chat). **Not** 1:1 runtime map for Forge studio conversations. Stream chat not used by global chatbar. |
| `GET /v1/skills` | Enumerate skills metadata | ❌ P2 |
| `GET /v1/toolsets` | Enumerate toolsets + tools | ❌ P2 |
| Header `X-Hermes-Session-Id` | Transcript/session continuity | ✅ Studio + process + automation: `forge-conv:{conversationId}` (`lib/chatbar/session-headers.ts`) |
| Header `X-Hermes-Session-Key` | **Stable long-term memory scope** (Honcho) | ✅ `forge:{userId}:{businessId}:{agentProfileKey\|default}` on interactive chat routes |
| Header `Idempotency-Key` | 5‑min response dedupe | ❌ P3 |

### Documented response shapes relevant to metering

**Chat Completions (non-stream):**

```json
"usage": { "prompt_tokens": 50, "completion_tokens": 200, "total_tokens": 250 }
```

**Responses API / Runs status:**

```json
"usage": { "input_tokens": 50, "output_tokens": 200, "total_tokens": 250 }
```

Streaming Chat Completions: final usage is **not** always present in SSE; Forge normalizes usage from stream chunks when present, else **`GET /v1/runs/{id}`** after the turn (`lib/hermes-stream.ts` → `fetchHermesRunUsage`).

---

## 3. Context window meter

### 3.1 Current Forge behavior (shipped — dual-mode)

| Layer | Implementation | Honesty |
|-------|----------------|---------|
| **Draft estimate (while typing)** | `estimateStudioPromptTokens` — history + draft + page context + fixed ~1200 char system overhead; `chars/4` | Local heuristic; labeled **estimate** |
| **Last-turn Hermes usage** | SSE `usage` (or run poll) → `NormalizedHermesUsage` → `lastTurnPromptTokens` on meter | **Real** turn `prompt_tokens` / `input_tokens` (billing-style, not remaining window) |
| **Limit** | `DEFAULT_MODEL_CONTEXT_TOKENS = 128_000` unless `modelContextTokens` passed | Callers **do not** pass a real model window yet |
| **UI** | Detail like `12k / 128k · est · last 18k`; tooltip distinguishes draft estimate vs last Hermes prompt | |

**Key files:**

- `lib/chatbar/usage.ts` — normalize Chat Completions / Responses / Runs usage  
- `lib/chatbar/context-meter.ts` — estimate + dual-mode display  
- `lib/hermes-stream.ts` — stream `usage` events + `fetchHermesRunUsage`  
- `lib/hermes.ts` — `callHermesWithMeta` returns `{ content, usage }` (string `callHermes` still discards usage for one-shot helpers)  
- `components/chatbar/ChatbarPanel.tsx` — `lastTurnUsage` state from SSE  
- Shared runners: `process-chat-turn.ts`, `automation-chat-turn.ts`  

**Still open (meter polish — P2):**

1. **Persist** last-turn usage (reload / thread switch clears client state).  
2. **Pass `modelContextTokens`** (or align default 128k → Hermes 256k fallback / label).  
3. **Richer estimate numerator** — fixed 1200 char overhead ≠ full system + docs envelope; optional server `promptChars` on receipt.  
4. Optionally seed fill bar from `lastTurnPromptTokens` when draft is empty (today last-turn is label-only; %).  

### 3.2 What the API server *does* give us today

| Signal | Source | Useful for meter? | Caveat |
|--------|--------|-------------------|--------|
| Turn `prompt_tokens` / `input_tokens` | Non-stream completion, Responses, stream chunk, `GET /v1/runs/{id}` | **Yes — last-turn prompt size** (wired) | Not remaining window; not post-compaction fill; not live while typing |
| Turn `completion_tokens` / `output_tokens` | Same | Cost / session totals | Not wired into dock meter |
| `total_tokens` | Same | Turn total | Cumulative ≠ context occupancy |
| Model id from `/v1/models` | `model` field | Label only | Not underlying LLM context size |
| Capabilities feature flags | `/v1/capabilities` | Gate stop/steer/approval UI | No context length |

### 3.3 What the API server does *not* give us (yet)

- **[NousResearch/hermes-agent#15618](https://github.com/NousResearch/hermes-agent/issues/15618)** — expose `context_tokens`, `context_length`, compaction metadata on run events (open as of research; P3 upstream).

Until that ships, clients cannot show a fully honest **remaining context** bar. Cumulative billing usage and local transcript estimates both fail after compaction (Hermes tracks better values internally via compressor / `model_metadata.py`).

**Proposed (not shipped) fields** from #15618:

```json
"usage": {
  "input_tokens": 12345,
  "output_tokens": 678,
  "total_tokens": 13023,
  "context_tokens": 45678,
  "context_length": 200000,
  "compression_count": 1,
  "context_source": "provider_prompt_tokens"
}
```

### 3.4 Implementation tiers (status)

| Tier | Goal | Status |
|------|------|--------|
| **A** | Parse/forward usage; dual-mode meter; SSE + run poll | **Done** (4.19 Task 1). Persist last usage still optional. |
| **B** | Real limit + estimate closer to server prompt | **Open (P2)** — see §3.1 polish list |
| **C** | Responses / Sessions server-side multi-turn | **Open (P1 optional)** — [`HERMES_RESPONSES_PILOT.md`](./HERMES_RESPONSES_PILOT.md) |
| **D** | Live remaining window / compaction-aware fill | **Blocked** on #15618 |

---

## 4. Inefficiencies & gaps beyond the meter

### 4.1 Full history re-send every turn (Chat Completions) — **open P1**

Studio (and process/automation) still rebuild large system + page + knowledge envelopes and post the full `messages[]` via `/v1/chat/completions`.

**Cost:** tokens, latency, silent compaction Forge never learns about.

**Better (API-supported):** Responses (`previous_response_id` / named `conversation`) or Sessions chat/stream. Keep Forge DB as product-of-record; Hermes for runtime continuity. **Handoff:** [`HERMES_RESPONSES_PILOT.md`](./HERMES_RESPONSES_PILOT.md).

### 4.2 `model` field is cosmetic — **UX done**

Chatbar model control documents that the request `model` field is cosmetic and the real LLM is server-side (Hermes config / profile). Multi-profile still surfaces profile names as model ids, not OpenRouter-style catalogs.

### 4.3 Process / automation chat streaming — **done**

Unified chatbar + shared stream runners (`process-chat-turn.ts`, `automation-chat-turn.ts`). Dual process/automation panel stacks removed (4.19 Task 9). Tool progress, run_id, stop/steer, usage share the studio path.

### 4.4 Usage on interactive chat — **done**; one-shots partial

Interactive routes emit SSE `usage` and update the dock meter. `callHermesWithMeta` can return usage; many one-shot helpers (`diagram`, `naming`, extract, …) still use string-only `callHermes` and discard usage — low priority unless product wants spend tracking there. Cronalytics already accounts **jobs** tokens separately.

### 4.5 Session headers — **done** (interactive chat)

```http
X-Hermes-Session-Key: forge:{userId}:{businessId}:{agentProfileKey|default}
X-Hermes-Session-Id: forge-conv:{conversationId}
```

Source: `lib/chatbar/session-headers.ts`. Optional consistency: set the same headers on one-shot `callHermes` paths (extract/diagram).

### 4.6 Skills / toolsets discovery — **open P2**

`GET /v1/skills` and `GET /v1/toolsets` unused. Candidate: Settings / personnel agent card without asking the model.

### 4.7 Approvals — **done** (Task 7)

Runtime maps `approval.request` → modal; `POST /v1/runs/{id}/approval` with `once` | `session` | `always` | `deny`.

### 4.8 `/health/detailed` — **open P2**

Authenticated readiness (active runs, disk, gateway state) without secrets — better desktop support than binary connected.

### 4.9 Stop path — **done for interactive**

Client abort + `POST .../stop` on active run. Applies to unified streamed chat (not a separate non-stream process path anymore).

### 4.10 Inline images — **open P3**

API supports multimodal user content; composer may not send `image_url` parts yet.

### 4.11 Named conversations / fork — **open P3**

Hermes sessions fork exists (Foundation Sessions UI can fork Hermes sessions). Not productized as “branch this Forge studio thread.”

### 4.12 Idempotency-Key — **open P3**

Double-submit hardening: `Idempotency-Key: {messageId}` (5‑min cache on Hermes).

---

## 5. Capability matrix (reconciled 2026-07-23)

| Capability | API support | Forge now | Priority |
|------------|-------------|-----------|----------|
| Context meter last-turn usage | usage objects | **Dual-mode (estimate + last Hermes prompt)** | Done (polish P2) |
| Context meter live `context_tokens` | #15618 (future) | N/A | When shipped |
| Stream studio chat | chat/completions SSE | Yes | Done |
| Stream process/automation chat | same | Yes | Done |
| Tool progress UI | `hermes.tool.progress` | Yes (unified chatbar) | Done |
| Stop run | `/v1/runs/{id}/stop` | Yes | Done |
| Steer run | `/v1/runs/{id}/steer` | Capability-gated | Done |
| Approve tools | `/v1/runs/{id}/approval` | Chatbar modal | Done |
| Server-side multi-turn | Responses / Sessions | No (pilot brief only) | **P1 optional** |
| Memory scope header | `X-Hermes-Session-Key` | Yes (interactive chat) | Done |
| Skills/toolsets catalog | GET endpoints | No | P2 |
| Health detailed | `/health/detailed` | No | P2 |
| Jobs API | `/api/jobs` | Yes | Done |
| Honest model UX | docs limitation | Label + tooltip | Done |
| Unified chatbar (single panel) | — | Yes (4.19) | Done |

---

## 6. Residual work (only open items)

Ordered by value. **Do not re-implement Tasks 1–7 / 9.**

1. **Responses / Sessions pilot (P1 optional)** — flag-gated studio turns; measure prompt-token reduction; Chat Completions fallback. → [`HERMES_RESPONSES_PILOT.md`](./HERMES_RESPONSES_PILOT.md)  
2. **Meter polish (P2)** — persist last usage; real or labeled context limit; better estimate overhead / optional server prompt size  
3. **Skills/toolsets panel (P2)** — `GET /v1/skills` + `/v1/toolsets`  
4. **`/health/detailed` (P2)** — connection details in Settings  
5. **Watch #15618** — when `context_tokens` + `context_length` land, switch meter primary source  
6. **P3** — multimodal `image_url`, Idempotency-Key, Forge thread fork UX  

### Shipped checklist (historical — original §6 sequence)

1. ~~Usage plumbing + dual-mode meter~~ Done  
2. ~~Process/automation stream parity~~ Done  
3. ~~Session-Key / Session-Id headers~~ Done  
4. Responses/Sessions pilot — **open**  
5. ~~Approval UI~~ Done  
6. Skills/toolsets — open P2  
7. Watch #15618 — ongoing  

---

## 7. Related links

| Resource | URL / path |
|----------|------------|
| API Server docs (upstream) | https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md |
| Local snapshot | [`upstream/hermes-api-server.md`](./upstream/hermes-api-server.md) |
| Context usage feature request | https://github.com/NousResearch/hermes-agent/issues/15618 |
| Hermes model metadata (internal) | https://github.com/NousResearch/hermes-agent/blob/main/agent/model_metadata.py |
| Responses pilot handoff | [`HERMES_RESPONSES_PILOT.md`](./HERMES_RESPONSES_PILOT.md) |
| Global chatbar design | [`GLOBAL_CHATBAR.md`](./GLOBAL_CHATBAR.md) |
| Usage normalize | `lib/chatbar/usage.ts` |
| Context meter | `lib/chatbar/context-meter.ts` |
| Session headers | `lib/chatbar/session-headers.ts` |
| Stream + run usage poll | `lib/hermes-stream.ts` |
| Capabilities / steer / approval | `lib/chatbar/capabilities.ts` |
| Connection probe | `lib/hermes-connection.ts` |

---

## 8. Changelog

| Date | Note |
|------|------|
| 2026-07-23 | **Docs reconcile:** mark Tasks 1–7/9 shipped; dual-mode meter truth; process/automation stream done; residual = Task 8 + P2 polish + #15618. Fix stale §3–6 / capability matrix. |
| 2026-07-22 | Foundation **Sessions** page + `/api/hermes/sessions/*` proxy. Stream chat still unused by chatbar. Responses pilot handoff doc added. |
| 2026-07-21 | Initial research from upstream `api-server.md` + Forge cross-check; archived raw doc; related #15618. |
