# Hermes Forge

**Map how your business actually works** — open-source process discovery with Hermes Agent.

Built for the **Hermes Agent Accelerated Business Hackathon** (NVIDIA × Stripe × Nous Research).

## Repository layout

This repo contains two products:

| Path | What it is | Run locally | Deploy |
|------|------------|-------------|--------|
| **Root** (`/`) | **Desktop / local app** — Next.js, auth, projects, process workshop, live Mermaid diagrams | `npm run dev` → http://localhost:3000 | Self-host or package as desktop exe (future) |
| **`website/`** | **Public marketing site** — landing page, GitHub link, desktop download CTA | `cd website && npm run dev` → http://localhost:4321 | Static `website/dist/` to your domain |

The app entry (`/`) redirects to `/login` or `/projects`. Marketing lives only in `website/`.

See [`website/README.md`](website/README.md) for site config and deployment.

## Quickstart (app)

1. Run Hermes Agent with API server:
   ```bash
   hermes gateway
   # API_SERVER_ENABLED + CORS for localhost:3000
   ```

2. In this repo:
   ```bash
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

The app ships as an Electron wrapper around the Next.js standalone server. Data and SQLite DB live in the OS user-data folder.

```bash
npm run desktop:dev     # dev: Electron + Next on port 3847
npm run desktop:build   # production installer → dist/desktop/
```

Publish installers to [GitHub Releases](https://github.com/karmsheel/hermes-forge/releases), then set `downloadComingSoon: false` in `website/src/config.ts`.

## Marketing site

```bash
cd website
npm install
npm run dev    # http://localhost:4321
npm run build  # output → website/dist/
```

Update `website/src/config.ts` before deploy: `appUrl` (optional hosted web app), `downloadUrl`, and `astro.config.mjs` `site` for your domain.