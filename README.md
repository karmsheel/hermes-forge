# Hermes Forge

**Map how your business actually works** — open-source process discovery with Hermes Agent.

Built for the **Hermes Agent Accelerated Business Hackathon** (NVIDIA × Stripe × Nous Research).

## Repository layout

| Repo | What it is | Run locally | Deploy |
|------|------------|-------------|--------|
| **[hermes-forge](https://github.com/karmsheel/hermes-forge)** (this repo) | **Desktop / local app** — Next.js, auth, projects, process workshop, live Mermaid diagrams | `npm run dev` → http://localhost:3000 | Self-host or `npm run desktop:build` |
| **[hermes-forge-website](https://github.com/karmsheel/hermes-forge-website)** | **Public marketing site** — landing page, GitHub link, desktop download CTA | Clone that repo separately | Static build to your domain |

The app entry (`/`) is the welcome sign-in / sign-up page. Marketing lives in the separate [hermes-forge-website](https://github.com/karmsheel/hermes-forge-website) repo.

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
   npx prisma migrate dev
   npm run dev
   ```

3. Open http://localhost:3000 — sign up, create a project, open the workshop.

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

Publish installers to [GitHub Releases](https://github.com/karmsheel/hermes-forge/releases), then link them from the marketing site.