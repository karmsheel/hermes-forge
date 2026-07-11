/**
 * Static page blurbs + UI hints for studio chat context.
 * Live snapshots come from /api/studio/page-snapshot + page registrations (PR-3).
 */

export type PageBlurb = {
  routeKey: string;
  title: string;
  purpose: string;
  uiHints?: string[];
};

const PAGE_BLURBS: { match: (path: string) => boolean; blurb: PageBlurb }[] = [
  {
    match: (p) => p === "/home" || p === "/",
    blurb: {
      routeKey: "home",
      title: "Home",
      purpose: "Start a new process from a brief, pick a template, or jump back into recent work.",
      uiHints: [
        "Type a brief in the home composer to create a process",
        "Open a recent process to continue mapping in Workshop",
        "Ask me what to map next for this business",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/functions"),
    blurb: {
      routeKey: "functions",
      title: "Functions",
      purpose: "Browse your org by department and see which workflows are mapped or automated.",
      uiHints: [
        "Click a function to open it filtered in Workshop",
        "Use the analytics section for automation coverage",
        "Ask which department needs mapping first",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/personnel/academy"),
    blurb: {
      routeKey: "personnel-academy",
      title: "Agent Academy",
      purpose:
        "Train hired Hermes agents by uploading skills and soul profiles (shared library later).",
      uiHints: [
        "Upload a skill or soul profile file",
        "Assign training to a hired agent",
        "Ask which skills this business should teach its agents",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/personnel/hire"),
    blurb: {
      routeKey: "personnel-hire",
      title: "Agent hire",
      purpose: "Hire a Hermes agent profile into this business as the chatbar persona.",
      uiHints: [
        "Scan local Hermes profiles",
        "Hire at least one agent to use the studio",
        "Hire more later from the Personnel roster",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/personnel"),
    blurb: {
      routeKey: "personnel",
      title: "Personnel",
      purpose: "Manage human teammates and Hermes agent profiles for this business.",
      uiHints: [
        "Hire humans or Hermes agent profiles",
        "Switch chatbar agents after hiring more than one",
        "Open Agent Academy to load skills and soul profiles",
        "Roster names feed workshop @-mentions and swimlanes",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/documents"),
    blurb: {
      routeKey: "documents",
      title: "Documents",
      purpose:
        "Business knowledge docs (basics, customers, market, strategy, notes). Pinned docs feed Hermes as durable context.",
      uiHints: [
        "Select a document to read or edit markdown",
        "Pin docs so Hermes uses them when mapping processes",
        "Import existing markdown business writing",
        "Ask me to draft or refine a section of the open document",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/workshop"),
    blurb: {
      routeKey: "workshop",
      title: "Workshop",
      purpose:
        "Map and refine process diagrams with Hermes. Process-scoped chat still lives in the workshop column for now; this bar is the studio co-pilot.",
      uiHints: [
        "Select a process in the left sidebar",
        "Use the workshop chat column for diagram edits",
        "Ask me to explain the active process or next steps",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/automations"),
    blurb: {
      routeKey: "automations",
      title: "Automations",
      purpose: "Design and deploy automations for approved processes.",
      uiHints: [
        "Open an approved process to plan or deploy",
        "Ask about deploy status or next automation candidate",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/log"),
    blurb: {
      routeKey: "log",
      title: "Business log",
      purpose: "Review the immutable event history for this business.",
      uiHints: [
        "Filter by event type",
        "Ask for a summary of recent activity",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/settings"),
    blurb: {
      routeKey: "settings",
      title: "Settings",
      purpose: "Appearance, connection, and developer options for Hermes Forge.",
      uiHints: [
        "I can explain settings pages — I never receive your API keys",
        "Use Connect Hermes for gateway status",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/business-manager"),
    blurb: {
      routeKey: "business-manager",
      title: "Business Manager",
      purpose: "Switch or create businesses. Chat stays scoped to the active business.",
      uiHints: [
        "Switch active business from the list",
        "Create a new business to isolate processes and chat",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/god-mode"),
    blurb: {
      routeKey: "god-mode",
      title: "God Mode",
      purpose: "Canvas overview of processes by department (dev-gated).",
      uiHints: ["Use this for a high-level process landscape"],
    },
  },
  {
    match: (p) => p.startsWith("/cronalytics"),
    blurb: {
      routeKey: "cronalytics",
      title: "Cronalytics",
      purpose: "Observe Hermes cron jobs and schedules (dev-gated).",
      uiHints: ["Ask about job health or recent runs"],
    },
  },
  {
    match: (p) => p.startsWith("/decisions"),
    blurb: {
      routeKey: "decisions",
      title: "Decisions",
      purpose: "Business decisions workspace (scaffold).",
      uiHints: ["Ask what belongs in a decision log"],
    },
  },
  {
    match: (p) => p.startsWith("/profile"),
    blurb: {
      routeKey: "profile",
      title: "Profile",
      purpose: "Your account profile for Hermes Forge.",
      uiHints: ["Update your display name or account details"],
    },
  },
];

export function pageBlurbForPath(pathname: string): PageBlurb {
  const path = String(pathname || "/home");
  return (
    PAGE_BLURBS.find((entry) => entry.match(path))?.blurb ?? {
      routeKey: "unknown",
      title: "Hermes Forge",
      purpose: "Ask Hermes about your business and whatever is on this page.",
      uiHints: ["Ask what you can do in Hermes Forge"],
    }
  );
}
