# Hermes Forge

**Map how your business actually works** — open-source process discovery with Hermes Agent.

Built for the **Hermes Agent Accelerated Business Hackathon** (NVIDIA × Stripe × Nous Research).

## Repository layout

| Repo | What it is | Run locally | Deploy |
|------|------------|-------------|--------|
| **[hermes-forge](https://github.com/karmsheel/hermes-forge)** (this repo) | **Desktop / local app** — Next.js, auth, projects, process workshop, live Mermaid diagrams | `npm run dev` → http://localhost:3000 | Self-host or `npm run desktop:build` |

The app entry (`/`) is the welcome sign-in / sign-up page.

## Quickstart (app)

1. Run Hermes Agent with API server:
   ```bash
   hermes gateway
   # API_SERVER_ENABLED + CORS for localhost:3000
   ```

2. Clone and install:
   ```bash
   git clone https://github.com/karmsheel/hermes-forge.git
   cd hermes-forge
   npm install
   cp .env.example .env   # set AUTH_SECRET at minimum
   npx prisma migrate dev
   npm run dev
   ```

3. Open http://localhost:3000 — choose local mode or GitHub on `/sign-in`, create a project, open the workshop.

## Environment

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | SQLite path (`file:./dev.db`) |
| `AUTH_SECRET` | Yes | Signs the `forge_session` cookie |
| `GITHUB_CLIENT_ID` | For GitHub login | OAuth App client id |
| `GITHUB_CLIENT_SECRET` | For GitHub login | OAuth App client secret |
| `GITHUB_REDIRECT_URI` | No | Override callback URL (default: `{origin}/api/auth/github/callback`) |

Local / no-account sign-in works without GitHub env vars. The GitHub button shows **Setup needed** until both client id and secret are set.

### GitHub OAuth App (one-time)

Identity-only login (scopes: `read:user`, `user:email`). No repo scopes.

**Host matters:** cookies are host-scoped. Desktop Electron serves `http://127.0.0.1:3847` (not `localhost`). Register **both** hosts if you switch between them, or stick to one consistently. Prefer `127.0.0.1` for desktop so it matches the Electron window.

1. Open [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**.
2. **Homepage URL**
   - Web dev: `http://localhost:3000` (or `http://127.0.0.1:3000`)
   - Desktop Electron: `http://127.0.0.1:3847` (default `FORGE_PORT`)
3. **Authorization callback URL** — register every origin you actually open in the browser/Electron:
   - `http://localhost:3000/api/auth/github/callback`
   - `http://127.0.0.1:3000/api/auth/github/callback`
   - `http://127.0.0.1:3847/api/auth/github/callback`
   - `http://localhost:3847/api/auth/github/callback` (only if you browse via localhost)
4. Create the app, generate a **Client secret**, put id + secret in `.env`, restart `npm run dev` / desktop.
5. On `/sign-in` or Profile, choose **GitHub**. Local → GitHub **upgrades the same user row** (businesses + Overlord preserved) when a local session started the OAuth flow, or when the only rich `local@hermes-forge.local` account has no `githubId` yet.

#### Local → GitHub upgrade (how it works)

1. Authorize step seals the current session `userId` into a signed OAuth `state` (survives session-cookie loss on the GitHub round-trip).
2. Callback prefers session cookie, then signed `linkUserId`, then existing `githubId` / email match, then a **sole rich local** placeholder (`local@hermes-forge.local` with businesses or Overlord and no `githubId`).
3. If that GitHub identity is already linked to a **different** user, you get a clear error on `/sign-in` — no silent merge of two rich accounts.

#### Recover a previously split local + empty GitHub user

If an older build created a second empty GitHub user while leaving data on `local@hermes-forge.local`:

```powershell
# Desktop DB (quit Hermes Forge first)
$env:DATABASE_URL = "file:$env:APPDATA\hermes-forge\forge.db"
node scripts/recover-github-local-link.mjs          # dry-run plan
node scripts/recover-github-local-link.mjs --apply  # execute
```

Optional: `--github-email=you@gmail.com` if more than one empty GitHub user exists.

## Hermes connection

- Default: `http://localhost:8642`
- Key: from `~/.hermes/.env` (`API_SERVER_KEY`)
- CORS: `API_SERVER_CORS_ORIGINS=http://localhost:3000`

The app proxies chat at `/api/hermes/chat` and runs background subagents for diagrams and workflow naming.

## Core thesis

Structured business discovery is the defensible IP — not the workflow builder. Hermes Forge turns conversation into a typed process model (projects, workflows, automation scores) with live diagrams, not chat logs alone.

## Tech (app)

- Next.js 16 + TypeScript
- Prisma + SQLite
- Hermes OpenAI-compatible API
- Mermaid 11 for live process diagrams

## Desktop app

The app ships as an Electron wrapper around the Next.js standalone server. Data and SQLite DB live in the OS user-data folder. First launch opens the welcome sign-in / sign-up page.

```bash
npm run desktop:dev     # dev: Electron + Next on port 3847
npm run desktop:build   # production installer → dist/desktop/
```

Publish installers to [GitHub Releases](https://github.com/karmsheel/hermes-forge/releases).