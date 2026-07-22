# Hermes Agent API Server — Forge capability audit

> **Upstream source (canonical):**  
> https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md  
>
> **Raw markdown:**  
> https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/user-guide/features/api-server.md  
>
> **Local archive (snapshot):** [`upstream/hermes-api-server.md`](./upstream/hermes-api-server.md)  
> **Researched:** 2026-07-21  
> **Purpose:** What the Hermes API server actually exposes, how Forge uses it today, what we can wire for the **context window meter**, and other inefficiencies / opportunities.

Re-fetch the upstream doc when re-auditing; capabilities move quickly. Keep this analysis updated when Forge adopts or deliberately skips a surface.

---

## 1. What the API server is

Hermes exposes an **OpenAI-compatible HTTP API** (default `http://127.0.0.1:8642`) so any frontend can use the agent with its full toolset (terminal, files, web, memory, skills). Auth is **Bearer** `API_SERVER_KEY`. CORS is off by default (Forge talks **server-to-server**, which matches the recommended pattern).

Important limitations called out by upstream:

| Limitation | Implication for Forge |
|------------|------------------------|
| **`model` field is cosmetic** | Request `model` does not switch the underlying LLM. Real model is configured server-side (`config.yaml` / profile). Forge’s model picker can only select **profile-advertised ids** (or confuse users if we imply provider model switching). |
| **No file upload** via API | Images yes (inline `image_url` / `input_image`); arbitrary files/`file_id` → 400. |
| **Response storage cap** | `previous_response_id` chain: max **100** stored responses (LRU), SQLite-persisted across restarts. |
| **Chat Completions is stateless** | Client must send full `messages[]` each turn. |

---

## 2. Endpoint inventory vs Forge usage

Legend: ✅ used · 🟡 partial · ❌ not used · ⚠️ used differently than designed

| Endpoint | Upstream purpose | Forge today |
|----------|------------------|-------------|
| `POST /v1/chat/completions` | Stateless chat; SSE + `hermes.tool.progress`; **`usage` in non-stream JSON** | ✅ Core path. **`callHermesWithMeta` + stream parse `usage`** (`lib/chatbar/usage.ts`); studio SSE emits `usage`; optional `GET /v1/runs/{id}` poll. Process chat still often non-stream until Task 4. |
| `POST /v1/responses` | Responses API; server-side history via `previous_response_id` / named `conversation`; tool calls in `output[]`; **`usage`** | ❌ Unused. Big opportunity for session continuity + less re-send. |
| `GET /v1/responses/{id}` | Fetch stored response | ❌ |
| `DELETE /v1/responses/{id}` | Delete stored response | ❌ |
| `GET /v1/models` | Advertise agent/profile as model id | ✅ Used for picker; only `id` kept — no metadata (and upstream rarely exposes real context length here). |
| `GET /v1/capabilities` | Feature discovery for UIs | ✅ Probe (`lib/hermes-connection.ts`); chatbar maps subset (`run_stop`, `run_steer`, …). |
| `GET /health` | Liveness | ✅ |
| `GET /v1/health` | Same under `/v1` | 🟡 unused (alias) |
| `GET /health/detailed` | Authenticated readiness (counts, not secrets) | ❌ Could power Settings “Hermes health” without scraping logs |
| `POST /v1/runs` | Async run create (`run_id`) | 🟡 We mostly rely on stream-embedded run ids, not explicit create |
| `GET /v1/runs/{id}` | Poll status + **`usage`** | 🟡 Studio chat polls after stream when usage missing from SSE |
| `GET /v1/runs/{id}/events` | SSE tool progress / deltas / lifecycle | 🟡 Studio proxies deltas/tools from chat-completions stream instead |
| `POST /v1/runs/{id}/stop` | Soft-cancel run | ✅ Chatbar stop |
| `POST /v1/runs/{id}/steer` | Steer active run | ✅ Capability-gated |
| `POST /v1/runs/{id}/approval` | Human approval for gated tools | ❌ Events normalized (`approval.requested`) but no approval UI → dead end if Hermes waits |
| Jobs `/api/jobs/*` | Cron/scheduled jobs CRUD + pause/run | ✅ Cronalytics / automation job surface |
| Sessions `/api/sessions/*` | List/create/fork/chat/stream Hermes sessions | 🟡 **Foundation → Sessions** (`/sessions`) proxies list/create/get/patch/delete/messages/fork/chat. Forge studio conversations remain separate (no 1:1 runtime map yet). Stream chat not proxied. |
| `GET /v1/skills` | Enumerate skills metadata | ❌ |
| `GET /v1/toolsets` | Enumerate toolsets + tools | ❌ |
| Header `X-Hermes-Session-Id` | Transcript/session continuity | ✅ Studio + process + automation chat: `forge-conv:{conversationId}` via `lib/chatbar/session-headers.ts` |
| Header `X-Hermes-Session-Key` | **Stable long-term memory scope** (Honcho), independent of transcript rotation | ✅ `forge:{userId}:{businessId}:{agentProfileKey\|default}` on interactive chat routes |
| Header `Idempotency-Key` | 5‑min response dedupe | ❌ |

### Documented response shapes relevant to metering

**Chat Completions (non-stream):**

```json
"usage": { "prompt_tokens": 50, "completion_tokens": 200, "total_tokens": 250 }
```

**Responses API / Runs status:**

```json
"usage": { "input_tokens": 50, "output_tokens": 200, "total_tokens": 250 }
```

Streaming Chat Completions: standard `chat.completion.chunk` + custom `hermes.tool.progress`. Final usage on streams is **not** clearly guaranteed in this doc; non-stream and `GET /v1/runs/{id}` are the reliable documented usage surfaces.

---

## 3. Context window meter — what is actually possible

### 3.1 Current Forge behavior (reminder)

`lib/chatbar/context-meter.ts`:

- **Used:** local `chars/4` over history + draft + page context + fixed ~1200 char overhead  
- **Limit:** hardcoded **128_000** (`DEFAULT_MODEL_CONTEXT_TOKENS`) unless `modelContextTokens` is passed (callers currently **don’t**)  
- UI explicitly labels **estimate**, not live runtime usage  

### 3.2 What the API server *does* give us today

| Signal | Source | Useful for meter? | Caveat |
|--------|--------|-------------------|--------|
| Turn `prompt_tokens` / `input_tokens` | Non-stream completion, Responses, `GET /v1/runs/{id}` | **Yes — last-turn prompt size** | Not remaining window; not post-compaction session fill; not live while typing |
| Turn `completion_tokens` / `output_tokens` | Same | Cost / session totals, not fill | |
| `total_tokens` | Same | Billing-ish total for the turn | Cumulative across turns ≠ context occupancy |
| Model id from `/v1/models` or capabilities | `model` field | Label only | Not the underlying LLM context size |
| Capabilities feature flags | `/v1/capabilities` | Gate UI | Does not include context length |

### 3.3 What the API server does *not* give us (yet)

Upstream issue tracking exactly this gap:

- **[NousResearch/hermes-agent#15618](https://github.com/NousResearch/hermes-agent/issues/15618)** — *“Expose real prompt context usage and compaction metadata in API run events”* (open as of research date; P3).

That issue states clients currently only have imperfect signals:

1. **Cumulative billing usage** ≠ current context (grows forever; doesn’t shrink after compaction).  
2. **Client transcript estimation** misses system prompt, memory, skills, tool schemas, hidden formatting, tokenizer differences; goes stale after compaction.

Hermes **internally** tracks better values (`last_prompt_tokens`, compressor, resolved `context_length` via `agent/model_metadata.py`), but those are **not** documented on the public API surface for thin clients.

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

Until that ships, **no client can show a fully honest “remaining context” bar** without estimating or proxying internal Hermes state.

### 3.4 Recommended Forge implementation tiers

#### Tier A — Wire documented usage (high value, low risk) — **do now**

1. Parse `usage` from:
   - Non-stream `callHermes` responses (today throws away whole JSON except content).  
   - Stream end: if a final chunk / run status includes usage, forward it; else after stream, optional `GET /v1/runs/{run_id}` when `run_id` known.  
2. Emit SSE event e.g. `usage` on studio/process chat routes.  
3. Context meter dual-mode:
   - **While composing:** keep improved local estimate (history + draft + *actual system/context strings we inject*).  
   - **After turn:** show **last prompt tokens** from Hermes (`prompt_tokens` / `input_tokens`) as “Last request: 18.4k tokens” and seed the next estimate baseline.  
4. Persist last usage on conversation/message row (optional) for re-open.

This is **real Hermes-reported data**, but it is **turn billing usage**, not live remaining context. Label clearly: *“Last turn · Hermes usage”* vs *“Draft estimate”*.

#### Tier B — Better limit + estimate (medium)

1. **Limit:**  
   - Prefer any future `context_length` from capabilities/run usage (#15618).  
   - Until then: static/family map (Hermes maintains rich tables in `agent/model_metadata.py` — we should **not** copy thousands of lines; use a small Forge map + override, or read Hermes health/config if ever exposed).  
   - Note: our default **128k** is *lower* than Hermes’ own default probe tier of **256k** (`DEFAULT_FALLBACK_CONTEXT` in model_metadata) — align or label.  
2. **Estimate numerator:** feed meter the **same system + page-context + documents + prior messages** the server builds in chat routes (or return a server `promptChars` estimate on a lightweight preflight). Process dock currently passes `draftText: ""` — fix.  
3. Do **not** pretend chars/4 is provider-true; keep “estimate” badge.

#### Tier C — Server-side session context (architecture; high impact)

If we adopt **Responses API** (`previous_response_id` or named `conversation`) or **Sessions API** (`/api/sessions/{id}/chat/stream`):

- Hermes holds tool-call-inclusive history server-side.  
- Client sends **delta turns**, not full 80-message rebuilds.  
- Meter should then **prefer Hermes-reported prompt tokens** after each turn, because local transcript no longer equals prompt.  
- Still need #15618 for post-compaction honesty.

#### Tier D — Blocked on Hermes

- Live remaining-window meter during a run  
- Compaction-aware fill %  
- Authoritative `context_length` for the *active* underlying model via API alone  

**Watch:** re-check #15618 and release notes periodically; when `context_tokens` / `context_length` land on `run.completed` or usage objects, wire them as primary meter source.

---

## 4. Inefficiencies & gaps beyond the meter

### 4.1 Full history re-send every turn (Chat Completions)

Studio chat loads up to **80** messages, rebuilds large system + page + knowledge envelopes, and posts the **entire** array on every turn via `/v1/chat/completions`.

**Cost:** tokens, latency, and risk of silent truncation/compaction inside Hermes that Forge never learns about.

**Better (API-supported):**

- `POST /v1/responses` + `previous_response_id` or `conversation: "<forge-conversation-id>"`  
- Or `POST /api/sessions/{id}/chat/stream` with Forge conversation mapped to Hermes session  

Keep Forge DB as product-of-record for UI/history/export; use Hermes session for **runtime** continuity.

### 4.2 `model` field is cosmetic

Upstream: *“the actual LLM model used is configured server-side.”*

Forge UI presents a model picker as if it switches backends. With multi-profile Hermes, `/v1/models` returns **profile names** as model ids (alice/bob), not GPT/Claude list.

**Action:** Clarify UX copy (“Hermes profile / agent model id”), stop implying OpenRouter-style model menus unless we multi-connect profiles (ports) or Hermes expands the models list.

### 4.3 Process / automation chat non-streaming

`app/api/processes/[id]/chat` and automation chat use **`callHermes` (stream: false)** while studio uses streaming + tools + run_id.

**Effects:** no token deltas, weak tool progress, harder stop/steer, no mid-run UX parity, longer TTFB.

**Action:** unify on `streamHermesEvents` (or Sessions/Runs SSE).

### 4.4 Usage discarded everywhere

`callHermes` returns only content string. Stream path never extracts usage. Cronalytics already understands token fields for **jobs**, but interactive chat never feeds the same accounting.

**Action:** Tier A above; optional “session token spend” in chat diagnostics.

### 4.5 No `X-Hermes-Session-Key` (memory scoping)

Without a stable key, long-term memory (Honcho) scopes per rotating `session_id`. Multi-business / multi-agent Forge threads may **share or fragment** memory incorrectly.

**Action:** set header per logical scope, e.g.:

```http
X-Hermes-Session-Key: forge:{userId}:{businessId}:{agentProfileKey}
```

(and optionally `X-Hermes-Session-Id: forge-conv:{conversationId}` for transcript).

### 4.6 Skills / toolsets discovery unused

`GET /v1/skills` and `GET /v1/toolsets` are read-only capability catalogs. Forge cannot show “what this agent can do” without asking the model.

**Action:** Settings / agent card: list enabled toolsets + skill names; empty-state coaching when tools missing.

### 4.7 Approvals endpoint unused

Runtime normalizes `approval.requested` / `approval.resolved`, but no UI calls `POST /v1/runs/{id}/approval`. If Hermes waits on approval, chat can hang.

**Action:** approval modal in chatbar when event arrives; capability-gate on `run_approval`.

### 4.8 `/health/detailed` unused

Authenticated readiness (active runs, disk, gateway state) without dumping secrets — better than “connected/not” alone for desktop support.

### 4.9 Dual client paths (AbortController vs run stop)

Stop uses both client abort and `POST .../stop`. Good. But process non-stream path cannot stop mid-generation cleanly.

### 4.10 Inline images supported; Forge may not send them

API supports multimodal user content. Composer attachments that aren’t wired as `image_url` parts leave vision unused.

### 4.11 Named conversations / fork

Sessions `fork` matches CLI `/branch`. Forge has no “branch this thread” — product opportunity for workshop experiment trees.

### 4.12 Idempotency-Key

Double-submit risk on flaky networks (studio send) could use `Idempotency-Key: {messageId}` for 5‑minute dedupe.

---

## 5. Capability matrix (target state)

| Capability | API support | Forge now | Priority for product |
|------------|-------------|-----------|----------------------|
| Context meter from last-turn usage | usage objects | Estimate only | **P0** |
| Context meter from live `context_tokens` | #15618 (future) | N/A | P0 when shipped |
| Stream studio chat | chat/completions SSE | Yes | Done |
| Stream process/automation chat | same | No | **P0** |
| Tool progress UI | `hermes.tool.progress` | Partial (studio) | P1 process parity |
| Stop run | `/v1/runs/{id}/stop` | Yes | Done |
| Steer run | `/v1/runs/{id}/steer` | Capability-gated | Done |
| Approve tools | `/v1/runs/{id}/approval` | No | **P1** |
| Server-side multi-turn | Responses / Sessions | No | **P1** (cost/latency) |
| Memory scope header | `X-Hermes-Session-Key` | No | **P1** |
| Skills/toolsets catalog | GET endpoints | No | P2 |
| Health detailed | `/health/detailed` | No | P2 |
| Jobs API | `/api/jobs` | Yes | Done (cron path) |
| Honest model UX | docs limitation | Misleading | **P1** copy |

---

## 6. Concrete next steps (suggested PR sequence)

1. **Usage plumbing** — parse + forward usage; dual-mode context meter; fix process draft in meter input.  
2. **Process chat stream parity** — same stream/tool/run_id path as studio.  
3. **Session-Key header** — business+agent stable memory scope.  
4. **Responses or Sessions pilot** — one conversation kind (e.g. studio) with `previous_response_id` / named conversation; measure token reduction.  
5. **Approval UI** — wire `run_approval`.  
6. **Skills/toolsets panel** — Settings / personnel.  
7. **Watch #15618** — when `context_tokens` + `context_length` land, switch meter primary source.

---

## 7. Related links

| Resource | URL |
|----------|-----|
| API Server docs (this research source) | https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md |
| Local snapshot of that doc | [`docs/references/upstream/hermes-api-server.md`](./upstream/hermes-api-server.md) |
| Context usage feature request | https://github.com/NousResearch/hermes-agent/issues/15618 |
| Hermes model metadata / context lengths (internal, not public API) | https://github.com/NousResearch/hermes-agent/blob/main/agent/model_metadata.py |
| Forge global chatbar design | [`GLOBAL_CHATBAR.md`](./GLOBAL_CHATBAR.md) |
| Forge context meter impl | `lib/chatbar/context-meter.ts` |
| Forge stream client | `lib/hermes-stream.ts` |
| Forge capabilities / steer | `lib/chatbar/capabilities.ts` |
| Forge connection probe | `lib/hermes-connection.ts` |

---

## 8. Changelog

| Date | Note |
|------|------|
| 2026-07-22 | Foundation **Sessions** page (`/sessions`) + `/api/hermes/sessions/*` proxy: list/create/get/patch/delete/messages/fork/chat. Stream chat still unused. |
| 2026-07-21 | Initial research from upstream `api-server.md` + cross-check against Forge clients; archived raw doc; related #15618. |
