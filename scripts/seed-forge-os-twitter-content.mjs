/**
 * Seed Hermes Forge X/Twitter tweet packs into the "Forge OS" business Content inventory.
 *
 * Usage (desktop DB — default):
 *   node scripts/seed-forge-os-twitter-content.mjs
 *
 * Custom DB:
 *   $env:DATABASE_URL = "file:./prisma/dev.db"
 *   node scripts/seed-forge-os-twitter-content.mjs
 *
 * Options:
 *   --dry-run     Print counts only, no writes
 *   --replace     Delete existing items with matching sourceTag prefix first
 */
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import os from "node:os";

const SOURCE_TAG = "twitter-pack-2026-07";
const BUSINESS_NAME = "Forge OS";

function defaultDesktopDbUrl() {
  const roaming = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const dbPath = path.join(roaming, "hermes-forge", "forge.db");
  // Prisma file URLs need forward slashes on Windows
  return `file:${dbPath.replace(/\\/g, "/")}`;
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const replace = args.has("--replace");

const databaseUrl = process.env.DATABASE_URL || defaultDesktopDbUrl();
const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

/** @type {{ pack: string; packLabel: string; id: string; title: string; body: string }[]} */
const TWEETS = [
  // ─── Pack A — Market / general ───────────────────────────────────────────
  {
    pack: "A",
    packLabel: "Market",
    id: "A1",
    title: "X · Market · One-job intro",
    body: `Hermes Forge has one job:

Turn “how does this business actually work?” into a living process map you can refine, forge, and automate.

Not a blank whiteboard.
Not a 47-tab Notion wiki.

Chat with Hermes. Watch the diagram build. Keep going until the map is true.

→ hermes-forge.com`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A2",
    title: "X · Market · Category definition",
    body: `Most “AI for ops” tools write more docs.

Hermes Forge maps the business.

Brief → process model → live Mermaid diagram → critique in chat → forge when it’s real.

The diagram is the product. The chat is how you shape it.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A3",
    title: "X · Market · Against the status quo",
    body: `Your company already has a process map.

It’s just distributed across:
• Slack threads
• people’s heads
• a Miro board nobody updated since Q2
• a PDF from the last consultant

Hermes Forge exists so the map lives in one place — and stays alive.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A4",
    title: "X · Market · You are the workflow",
    body: `If the only way work moves through your business is a human remembering the next step…

you don’t have a process.

You have a person acting as a brittle, unpaid orchestration layer.

Write the process once. Forge it. Then decide what should run without them.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A5",
    title: "X · Market · Local-first / BYOK",
    body: `Hermes Forge is local-first.

You bring your own Hermes Agent.
Your process maps and business data stay on your machine.
No “upload your org chart to our cloud so we can invent workflows for you.”

The studio is ours.
The reasoning engine is yours.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A6",
    title: "X · Market · Rooms metaphor",
    body: `Think of Hermes Forge as a place with rooms:

Foundation — talk the business into existence
Map — see how work actually flows
Monitor — instrument what you’ve forged
Automate — turn forged processes into real jobs

Workshop isn’t a room.
It’s the forge bench inside Map.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A7",
    title: "X · Market · Underlord / Foundation",
    body: `New businesses don’t start with a perfect flowchart.

They start in Foundation.

Talk to Underlord. Sketch the plant. Draft processes appear as you describe how work really moves — not how the org chart pretends it does.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A8",
    title: "X · Market · Plant metaphor",
    body: `A business is a designed plant.

Not in the “chemical engineering homework” sense.
In the “stuff moves through units and either works or bottlenecks” sense.

Hermes Forge’s Map is that overview:
processes as shapes, connections as flow, the whole business on one canvas.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A9",
    title: "X · Market · Core loop",
    body: `The Hermes Forge loop:

1. Describe a workflow in plain language
2. Watch a live process diagram stream in
3. Push back in chat (“no, finance never sees this”)
4. Refine until the map matches reality
5. Forge it when it’s ready to operate on

Discover → lock → stream → critique → deliver.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A10",
    title: "X · Market · vs Lucid / Miro / Visio",
    body: `Whiteboarding tools are great for workshops.

They’re terrible as systems of record for how work actually runs.

Hermes Forge is agent-native process mapping:
Hermes reasons, the studio renders, you correct, the model stays structured.

Less sticky notes. More operating model.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A11",
    title: "X · Market · For founders",
    body: `If you’re a founder who “just knows how the business works” —

that knowledge is a single point of failure.

Hermes Forge is how you extract it:
chat the ops into a process map while Hermes drafts the structure and diagram with you.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A12",
    title: "X · Market · For ops / consultants",
    body: `Consultant special move:
leave behind a 40-page process deck nobody maintains.

Hermes Forge special move:
leave behind a living map the team can open, critique, forge, and eventually automate.

Same clarity. Longer half-life.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A13",
    title: "X · Market · Forge lifecycle",
    body: `In Hermes Forge, processes have a life:

draft → refined → forged

Draft: still exploring
Refined: honest and reviewed
Forged: real enough to instrument and automate

Monitor and Automate unlock as you forge — not as you fill out more forms.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A14",
    title: "X · Market · Automate punchline",
    body: `Automation without a true process map is just expensive spaghetti.

Map first.
Forge when it’s real.
Then Automate.

Hermes Forge is built for that order — not “connect 12 tools and hope the business logic was correct.”`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A15",
    title: "X · Market · Desktop product",
    body: `Hermes Forge is a desktop studio for people who run real businesses with Hermes Agent.

Windows installer. Local SQLite. Your agent. Your processes.

Built for mapping work — not for another browser tab that forgets what your company is.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A16",
    title: "X · Market · What it is / isn’t",
    body: `Hermes Forge is:
• a process mapping studio
• powered by Hermes Agent
• local-first / BYOK
• diagram + model + chat in one loop

Hermes Forge is not:
• another generic chatbot with a flowchart skin
• a forced cloud SaaS that owns your operating model
• a blank canvas that waits for you to drag boxes all day`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A17",
    title: "X · Market · Hot take",
    body: `Hot take:

Your biggest ops problem isn’t “we need more AI agents.”

It’s that nobody can point to one true map of how work moves — and keep it true for more than a sprint.

Agents on a fuzzy process just scale the confusion.

Map the plant. Then automate.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A18",
    title: "X · Market · Tool contrast list",
    body: `Tools people use when they mean “map the business”:

• Miro / FigJam — great workshops, weak system of record
• Lucid / Visio — precise drawings, no agent in the loop
• Notion / Confluence — docs that drift from reality
• n8n / Zapier alone — automation without a shared truth

Hermes Forge:
chat → living process map → forge → automate

Different layer.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A19",
    title: "X · Market · Demo CTA",
    body: `Try this prompt in Hermes Forge:

“Map how a new customer goes from first payment to first successful outcome in our product. Include handoffs, tools, and where things usually break.”

Then correct Hermes in chat until the diagram feels uncomfortable in the right way — i.e. honest.

That’s the product.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A20",
    title: "X · Market · Multi-business isolation",
    body: `One machine. Multiple businesses.

Hermes Forge keeps each business’s processes, chats, and maps isolated.

Switch businesses without mixing ops DNA.
Map a client plant. Map your own. Don’t contaminate either.`,
  },
  {
    pack: "A",
    packLabel: "Market",
    id: "A21",
    title: "X · Market · Closing brand / soft CTA",
    body: `We’re building Hermes Forge for people who want their business to be designed — not improvised forever.

Foundation to understand.
Map to see.
Forge to commit.
Automate to scale.

If you already run Hermes Agent and care about how work actually moves:

→ hermes-forge.com

Bring your agent. We’ll bring the studio.`,
  },

  // ─── Pack B — Hermes Agent users ─────────────────────────────────────────
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B1",
    title: "X · Hermes users · Bridge from Hermes",
    body: `You already run Hermes Agent.

Hermes Forge is the studio surface for when the job isn’t “write code” or “answer Slack” —

it’s “map how this business actually works” and keep that map alive.

Same agent. Different workbench.
→ hermes-forge.com`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B2",
    title: "X · Hermes users · One job for Hermes people",
    body: `Hermes Agent: reasoning, tools, memory, skills, gateways.

Hermes Forge: turn that agent into a business process mapping loop.

Brief → structured process model → live diagram → critique in chat → forge.

Your Hermes stays yours. Forge is the shell.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B3",
    title: "X · Hermes users · BYOK explicit",
    body: `Hermes Forge is BYOK by design.

Point it at your Hermes instance.
No “our model, our cloud, your processes now live on our servers.”

You bring the agent.
We bring the workshop: diagram, process model, rooms, forge lifecycle.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B4",
    title: "X · Hermes users · Not another agent chat UI",
    body: `If you wanted another chat window for Hermes, you’d already have one.

Forge isn’t “Hermes but prettier.”

It’s where process maps, Mermaid diagrams, and forge state are first-class —
and Hermes is the co-pilot shaping them.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B5",
    title: "X · Hermes users · Gateway / local stack",
    body: `Running hermes gateway locally?

Good. Keep it.

Hermes Forge connects as a client studio:
local data, your endpoint, your agent personality and tools —

now aimed at ops maps instead of freeform sessions.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B6",
    title: "X · Hermes users · Skills → structured ops",
    body: `You can teach Hermes a skill for almost anything.

What most businesses still lack is a single structured map of unit operations:
who hands off to whom, when, with which tools, where it breaks.

Forge is where Hermes helps you build that map as an artifact — not just a long chat transcript.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B7",
    title: "X · Hermes users · Transcripts vs models",
    body: `A great Hermes session about “how onboarding works” dies in the scrollback.

Hermes Forge’s job is to pull that conversation into:
• a process model
• a live diagram
• a forgeable unit you can revisit next month

Chat is the input. The map is the deliverable.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B8",
    title: "X · Hermes users · Workshop as agent workbench",
    body: `Workshop in Hermes Forge is a three-lane agent workbench:

• process list / context
• streaming Mermaid as the artifact
• process chat with Hermes as the critic and co-author

Same agent-native loop you like elsewhere —
artifact in the center, not buried in markdown.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B9",
    title: "X · Hermes users · Foundation + Underlord",
    body: `Foundation is where new businesses start in Forge.

You talk to Underlord (Foundation’s co-pilot persona on Hermes).
Draft processes and plant sketch appear as you describe reality.

Hermes users: think of it as a dedicated intake session with a structured output contract.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B10",
    title: "X · Hermes users · Map room = plant canvas",
    body: `Map isn’t a folder of chats.

It’s the plant canvas: processes as shapes, connections as flow, whole business in view.

Click into a unit → open Workshop → refine with Hermes → forge when it’s true.

Agent for depth. Canvas for the system.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B11",
    title: "X · Hermes users · Forge lifecycle",
    body: `Hermes can draft anything in one shot.

Forge still makes you commit:

draft → refined → forged

Forged is the gate: “this process is honest enough to instrument and automate.”

Keeps agent speed without pretending every first diagram is production truth.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B12",
    title: "X · Hermes users · Multi-business, one Hermes",
    body: `One Hermes install.
Many businesses in Forge.

Each business keeps its own processes, chats, and maps isolated.

Client plant A doesn’t bleed into your own ops or client plant B.
Switch contexts without trashing the agent’s mental model of “the company.”`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B13",
    title: "X · Hermes users · Documents + context",
    body: `Hermes is better when it has the right context.

In Forge, business knowledge and process maps live with the business —
so process chat isn’t starting from zero every time you open a session.

Map + model + history, not a cold chat with a pasted org chart.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B14",
    title: "X · Hermes users · From map to automate",
    body: `You already automate with Hermes: cron, tools, messaging, skills.

Forge’s order is deliberate:

1. Map the process with Hermes
2. Forge when it’s real
3. Automate from a forged map

So the agent isn’t wiring n8n-style spaghetti to a story that only exists in your head.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B15",
    title: "X · Hermes users · Decisions / HITL",
    body: `Agent-native doesn’t mean unsupervised forever.

Forge has a Decisions surface for human-in-the-loop moments —
the same instinct as approving a risky tool call, applied to business process governance.

Map fast. Commit carefully.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B16",
    title: "X · Hermes users · Business log",
    body: `Hermes users care about what the agent did.

Forge keeps a business log: append-only events for what changed in the plant —
so the operating model has a history, not just “the diagram looks different today.”`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B17",
    title: "X · Hermes users · Desktop pairing",
    body: `Hermes Desktop (or CLI + gateway) for the agent.
Hermes Forge for the process studio.

Different apps, same philosophy:
local-first, agent-native, you own the stack.

If Hermes already lives on your machine, Forge is the next surface for ops mapping work.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B18",
    title: "X · Hermes users · Prompt that feels native",
    body: `Paste this into Forge process chat (with Hermes connected):

“Using our real handoffs, map the path from inbound lead to closed-won to onboarding complete. Call out tools, owners, and every place we currently rely on someone remembering a step.”

Then argue with the diagram until Hermes stops inventing happy paths.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B19",
    title: "X · Hermes users · vs generic AI diagram tools",
    body: `Generic AI flowchart tools:
prompt once → pretty boxes → export PNG → die in Drive.

Hermes Forge:
your Hermes Agent in the loop, iterative critique, structured process model, forge lifecycle, path to automate.

Same “diagram” word. Different product.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B20",
    title: "X · Hermes users · Why Hermes specifically",
    body: `Forge is built around Hermes Agent as the reasoning engine —
OpenAI-compatible, local or remote, your keys, your install.

We’re not shipping a locked model behind a subscription and calling it “AI mapping.”

If you’re already in the Hermes ecosystem, this is the process studio for that stack.`,
  },
  {
    pack: "B",
    packLabel: "Hermes users",
    id: "B21",
    title: "X · Hermes users · CTA",
    body: `If Hermes Agent already runs your workflows, research, or messaging —

point it at Hermes Forge and map one real process this week.

One business. One painful workflow. Chat until the diagram is honest. Forge it.

→ hermes-forge.com

Bring your agent. Keep your data. Ship the map.`,
  },

  // ─── Pack C — Operators ──────────────────────────────────────────────────
  {
    pack: "C",
    packLabel: "Operators",
    id: "C1",
    title: "X · Operators · One-liner",
    body: `Hermes Forge is for operators who are tired of being the process.

Chat the way work actually moves.
Get a living process map.
Refine it until it’s true.
Forge it when the team can run it without you narrating every step.

→ hermes-forge.com`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C2",
    title: "X · Operators · The real SOP problem",
    body: `SOPs fail in three ways:

1. Never written
2. Written once, wrong forever
3. Written correctly, never opened again

Hermes Forge targets a fourth path:
a map you critique in conversation and keep current as the business changes.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C3",
    title: "X · Operators · Handoffs",
    body: `Most “ops problems” are handoff problems.

Sales → success
Success → product
Finance → whoever chases the invoice
Support → engineering with a screenshot and a prayer

Hermes Forge maps handoffs as first-class flow — not a bullet list buried in a wiki.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C4",
    title: "X · Operators · Hero dependency",
    body: `If the business only works when one person is in Slack…

you don’t have a process.
You have a hero schedule.

Operators use Hermes Forge to pull that knowledge out of one head and into a shared map the team can see, argue with, and improve.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C5",
    title: "X · Operators · Board / consultant graveyard",
    body: `The last process project produced:
• a deck
• a RACI nobody opens
• a Lucidchart with three owners and zero updates

Hermes Forge is built so the output is a living map inside the studio —
not a PDF that ages out the week after the workshop.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C6",
    title: "X · Operators · Clarity before headcount",
    body: `Hiring before you map the work multiplies chaos.

Operators know this.
Boards sometimes don’t.

Hermes Forge helps you show the plant: where work queues, where it breaks, where another hire is a band-aid on a broken handoff.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C7",
    title: "X · Operators · How we do things here",
    body: `“How we do things here” shouldn’t require a 45-minute verbal tour every time someone joins.

In Forge:
describe the workflow once with the agent co-pilot
correct the diagram until veterans nod
forge it as the reference path

Onboarding gets a map. Veterans get fewer interrupt questions.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C8",
    title: "X · Operators · Exception paths",
    body: `Happy-path SOPs are fiction.

Real operators care about:
• what happens when payment fails
• when the customer goes dark
• when legal needs a review
• when the tool is down

Prompt for exceptions in Hermes Forge until the map includes the ugly branches — that’s when it becomes useful.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C9",
    title: "X · Operators · Single source of operational truth",
    body: `Ops shouldn’t live in five places:

Slack for “what we decided”
Notion for “what we intended”
Sheets for “what we track”
Someone’s memory for “what we actually do”

Hermes Forge aims the map at what you actually do — then you decide what to document, measure, and automate.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C10",
    title: "X · Operators · Meeting replacement (partial)",
    body: `Not every process needs a meeting.

Some need 20 minutes in Forge:
open the process, argue with the diagram, leave a clearer map than when you started.

Async critique beats another “alignment” call that produces no artifact.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C11",
    title: "X · Operators · Cross-functional without politics theater",
    body: `Cross-functional pain is often just missing shared pictures.

Put sales, success, and ops in front of the same process map.
Let them correct the same diagram.

Hermes Forge makes the disagreement concrete: wrong step, wrong owner, wrong order — not vague vibes.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C12",
    title: "X · Operators · Rooms in operator language",
    body: `Hermes Forge rooms, translated for operators:

Foundation — intake: what is this business and how does work start
Map — the overview of how work moves end to end
Monitor — watch what you’ve committed to as real
Automate — only after the process is forged, not before

Map first. Automate second. Always.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C13",
    title: "X · Operators · Forge means commitment",
    body: `In Hermes Forge, “forged” means:

we’re done pretending this process is a draft.
the team can treat it as how work should run.
it’s ready to measure and, if it earns it, automate.

Drafts are cheap.
Commitment is the product.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C14",
    title: "X · Operators · Automate last",
    body: `Operators who automate first regret it.

Bad automation freezes a wrong process at machine speed.

Hermes Forge is opinionated on purpose:
map → refine → forge → then automate.

Speed of execution without truth is just faster failure.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C15",
    title: "X · Operators · Multi-client / multi-brand ops",
    body: `Agencies and multi-brand operators: each client business is its own plant.

Hermes Forge isolates businesses so Client A’s onboarding map doesn’t pollute Client B’s.

Same studio. Separate operating models. Switch context cleanly.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C16",
    title: "X · Operators · Local-first for sensitive ops",
    body: `Ops maps often include real tools, vendors, and failure modes you don’t want as training data for a random cloud product.

Hermes Forge is local-first: your data, your agent connection, your machine.

Map the business without shipping the business to someone else’s SaaS by default.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C17",
    title: "X · Operators · Weekly ops ritual",
    body: `A simple Forge ritual for operators:

Every Friday:
1. Open the process that broke this week
2. Update the map in chat (“we actually do X, not Y”)
3. Re-forge if the change is real
4. Note what still needs a human decision

Thirty minutes. Map stays honest. Less tribal knowledge rot.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C18",
    title: "X · Operators · Operator prompt pack",
    body: `Three prompts that work well in Hermes Forge:

1. “Map quote-to-cash. Mark every handoff and every tool.”
2. “Map incident response from first alert to customer update. Include who must approve.”
3. “Map hiring from req open to day-30. Show where candidates stall.”

Correct until a senior operator says: yes, that’s us.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C19",
    title: "X · Operators · Metrics without theater",
    body: `You can’t instrument what you haven’t defined.

Monitor in Hermes Forge is for processes you’ve forged —
so metrics attach to real workflows, not vanity dashboards about “activity.”

Define the path. Then measure the path.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C20",
    title: "X · Operators · What good looks like",
    body: `A good week with Hermes Forge for an operator:

• one painful workflow mapped honestly
• exceptions included, not just the brochure version
• owners and tools visible on the diagram
• process forged so the team can stop re-explaining it
• one candidate step flagged for automation later

That’s progress. Not another wiki page.`,
  },
  {
    pack: "C",
    packLabel: "Operators",
    id: "C21",
    title: "X · Operators · CTA",
    body: `If you run operations — or you are operations —

pick the workflow that ate your week.

Open Hermes Forge.
Describe it like you’d brief a sharp new hire.
Fix the diagram until it’s true.
Forge it.

→ hermes-forge.com

Stop being the only working process in the building.`,
  },
];

function bodyWithMeta(tweet) {
  return `<!-- ${SOURCE_TAG} | pack=${tweet.pack} | id=${tweet.id} | audience=${tweet.packLabel} -->

${tweet.body.trim()}
`;
}

async function main() {
  console.log("DATABASE_URL:", databaseUrl);
  console.log("Tweets to seed:", TWEETS.length);

  const business = await prisma.business.findFirst({
    where: { name: BUSINESS_NAME },
    select: { id: true, name: true },
  });

  if (!business) {
    console.error(`Business "${BUSINESS_NAME}" not found. Create/select it in the app first.`);
    process.exit(1);
  }

  console.log(`Target business: ${business.name} (${business.id})`);

  if (dryRun) {
    console.log("[dry-run] would create", TWEETS.length, "content items (channel=x, status=ready)");
    await prisma.$disconnect();
    return;
  }

  if (replace) {
    const existing = await prisma.contentItem.findMany({
      where: {
        businessId: business.id,
        bodyMarkdown: { contains: SOURCE_TAG },
      },
      select: { id: true },
    });
    if (existing.length) {
      await prisma.contentItem.deleteMany({
        where: { id: { in: existing.map((e) => e.id) } },
      });
      console.log(`Removed ${existing.length} existing pack items (${SOURCE_TAG})`);
    }
  }

  const data = TWEETS.map((tweet) => ({
    businessId: business.id,
    title: tweet.title,
    bodyMarkdown: bodyWithMeta(tweet),
    status: "ready",
    channel: "x",
    source: "import",
  }));

  // createMany is fine for SQLite in Prisma
  const result = await prisma.contentItem.createMany({ data });
  console.log(`Created ${result.count} content items on "${business.name}"`);

  const health = await prisma.contentItem.groupBy({
    by: ["status"],
    where: { businessId: business.id },
    _count: { _all: true },
  });
  console.log("Content health:", Object.fromEntries(health.map((h) => [h.status, h._count._all])));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
