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

1. Open [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**.
2. **Homepage URL**
   - Web dev: `http://localhost:3000`
   - Desktop Electron: `http://localhost:3847` (default `FORGE_PORT`)
3. **Authorization callback URL** (add one app per origin, or use the same app and register the URL you will hit):
   - `http://localhost:3000/api/auth/github/callback`
   - `http://localhost:3847/api/auth/github/callback`
4. Create the app, generate a **Client secret**, put id + secret in `.env`, restart `npm run dev`.
5. On `/sign-in` or Profile, choose **GitHub**. If you already have a local session, GitHub **links to that same user** (businesses preserved).

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