# Hermes Forge

**Describe your business. Deploy intelligent workflows.** (Phase 1: Business Discovery)

Built for the **Hermes Agent Accelerated Business Hackathon** (NVIDIA × Stripe × Nous Research).

## Core Thesis (per PRD)

The defensible IP is **structured business discovery**, not the workflow builder.

Hermes Forge uses Hermes Agent to conduct a natural business interview, then extracts and scores real operational processes into a typed knowledge graph (Business + Processes + Automation Scores).

Workflow generation is intentionally **out of scope** for this phase.

## Current State (Hackathon MVP)

**Phase 1 Complete:**
- Landing page with strong positioning
- Conversational Interview powered by real Hermes Agent
- Structured extraction into SQLite (Prisma)
- Live Dashboard with automation scores (0-100)
- Export Business Knowledge Graph (JSON)

## Quickstart (for Demo Video)

1. Run Hermes Agent with API server:
   ```bash
   # In your Hermes terminal
   hermes gateway
   # Make sure API_SERVER_ENABLED + CORS for localhost:3000
   ```

2. In this repo:
   ```bash
   npm install
   npx prisma migrate dev
   npm run dev
   ```

3. Go to http://localhost:3000
4. Click "Start Business Interview"
5. Make sure Hermes connection points to your running instance
6. Talk through your business (or a demo business)

Recommended demo flow:
- Connect Hermes
- Do a 60-90 second interview covering offering, customers, delivery, tools, pain
- Watch structured data populate on the right
- Go to Dashboard → see scored processes
- Export the JSON artifact

## Hermes Connection

- Default: `http://localhost:8642`
- Key: whatever you set in `~/.hermes/.env` (`API_SERVER_KEY`)

Set CORS if calling from browser:
```
API_SERVER_CORS_ORIGINS=http://localhost:3000
```

The app also has a proxy at `/api/hermes/chat` that can help avoid some CORS pain.

## Architecture Decisions (Opinionated)

- All business knowledge lives in structured tables, **not** chat logs.
- Hermes is used for two things:
  1. Natural language interview (chat)
  2. Structured JSON extraction (Business Analyst + Process Analyst + Automation Architect roles)
- Human always in the loop.
- n8n and deployment deliberately not built yet.

## Tech

- Next.js 16 + TypeScript
- Prisma + SQLite (easy to upgrade)
- Direct Hermes OpenAI-compatible API
- shadcn-ready styling (clean dark UI)

## Next Phases (Future)

- Process refinement editor
- Workflow graph generation from Process model
- n8n JSON export
- Direct deployment + observability

## Submission Notes

- 1-3 min video of the interview + dashboard
- Tag @NousResearch
- Drop in Discord + Typeform

Good luck!
