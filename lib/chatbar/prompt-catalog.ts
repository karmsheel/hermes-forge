/**
 * Central registry of Hermes system prompts used by Forge.
 * Settings → Agent prompts and chat routes must share these builders —
 * never duplicate prompt bodies elsewhere.
 */

import { buildAutomationChatSystemPrompt } from "@/lib/automation-chat";
import { EXTRACTION_SYSTEM } from "@/lib/automation-extract";
import { buildCronPrompt } from "@/lib/automation-deploy";
import {
  buildChatSystemPrompt,
  DIAGRAM_SYSTEM_PROMPT,
} from "@/lib/diagram";
import type { ChatbarContextMode } from "./context-scope";
import type { ForgeContextPayload } from "./context-protocol";
import {
  buildStudioChatSystemPrompt,
  buildStudioPageContextMessage,
} from "./studio-prompt";
import { pageBlurbForPath } from "./page-registry";

export const PROMPT_PACK_IDS = [
  "studio-default",
  "foundation",
  "map-plant",
  "workshop-process",
  "automation-architect",
  "diagram-subagent",
  "automation-extract",
  "automation-deploy",
] as const;

export type PromptPackId = (typeof PROMPT_PACK_IDS)[number];

export type PromptSurface = "chatbar" | "background" | "job";

export type PromptCatalogMeta = {
  id: PromptPackId;
  title: string;
  surface: PromptSurface;
  routes: string[];
  description: string;
};

export type PromptBuildContext = {
  businessName: string;
  route: string;
  mode?: ChatbarContextMode;
  agent?: {
    displayName: string;
    description?: string | null;
    model?: string | null;
    profileKey?: string | null;
  } | null;
  trainingPrompt?: string | null;
  processName?: string;
  /** Full process chat context when available (live chat / rich preview). */
  processContext?: Parameters<typeof buildChatSystemPrompt>[0];
  pageContextPayload?: ForgeContextPayload;
};

export type BuiltPromptPack = {
  system: string;
  pageContext: string | null;
};

const CATALOG: PromptCatalogMeta[] = [
  {
    id: "studio-default",
    title: "Studio co-pilot",
    surface: "chatbar",
    routes: ["/* (default)"],
    description:
      "Shell-level Hermes co-pilot: page purpose, agent identity, untrusted page snapshot rules.",
  },
  {
    id: "foundation",
    title: "Foundation / Overlord",
    surface: "chatbar",
    routes: ["/foundation"],
    description:
      "Studio co-pilot plus Overlord plant guidance (forge-drafts / forge-docs / forge-links fences).",
  },
  {
    id: "map-plant",
    title: "Map plant",
    surface: "chatbar",
    routes: ["/god-mode", "/map"],
    description:
      "Studio co-pilot focused on plant process selection and plant handoff links.",
  },
  {
    id: "workshop-process",
    title: "Workshop process mapping",
    surface: "chatbar",
    routes: ["/workshop"],
    description:
      "Business process analyst for a single process thread (diagram updates separately).",
  },
  {
    id: "automation-architect",
    title: "Automation design",
    surface: "chatbar",
    routes: ["/automations/*"],
    description:
      "Automation Architect: Hermes cron vs n8n plan design on a forged process.",
  },
  {
    id: "diagram-subagent",
    title: "Diagram subagent",
    surface: "background",
    routes: ["/workshop (background)"],
    description:
      "Mermaid flowchart generator that runs beside process chat; returns only Mermaid.",
  },
  {
    id: "automation-extract",
    title: "Automation plan extractor",
    surface: "background",
    routes: ["/automations (background)"],
    description:
      "JSON extractor that turns design chat into a structured AutomationPlan.",
  },
  {
    id: "automation-deploy",
    title: "Automation deploy (cron job)",
    surface: "job",
    routes: ["Cron / scheduled jobs"],
    description:
      "Runtime instructions for a deployed Hermes cron job executing a process automation.",
  },
];

export function listPromptCatalog(): PromptCatalogMeta[] {
  return CATALOG.map((entry) => ({ ...entry }));
}

export function isPromptPackId(value: string): value is PromptPackId {
  return (PROMPT_PACK_IDS as readonly string[]).includes(value);
}

function defaultProcessContext(
  processName: string,
): Parameters<typeof buildChatSystemPrompt>[0] {
  return {
    processName,
    description: "",
    nameStatus: "confirmed",
    status: "draft",
    hasDiagram: false,
    shouldAskAccuracy: false,
  };
}

function studioSystem(ctx: PromptBuildContext, route: string): string {
  return buildStudioChatSystemPrompt({
    businessName: ctx.businessName,
    route,
    page: pageBlurbForPath(route),
    mode: ctx.mode || "follow-page",
    agent: ctx.agent,
    trainingPrompt: ctx.trainingPrompt,
  });
}

function studioPageContext(ctx: PromptBuildContext, route: string): string | null {
  if (ctx.pageContextPayload) {
    return buildStudioPageContextMessage({ payload: ctx.pageContextPayload });
  }
  return buildStudioPageContextMessage({
    route,
    page: pageBlurbForPath(route),
    businessName: ctx.businessName,
    mode: ctx.mode || "follow-page",
    snapshotText:
      "(Settings preview — no live page snapshot. Open the page and chat to inject real context.)",
    firstVisit: false,
  });
}

/**
 * Build system (+ optional page context) for a pack.
 * Same functions interactive chat routes should call.
 */
export function buildPromptPack(
  id: PromptPackId,
  ctx: PromptBuildContext,
): BuiltPromptPack {
  switch (id) {
    case "studio-default": {
      const route = ctx.route || "/home";
      return {
        system: studioSystem(ctx, route),
        pageContext: studioPageContext(ctx, route),
      };
    }
    case "foundation": {
      const route = ctx.route?.startsWith("/foundation")
        ? ctx.route
        : "/foundation";
      return {
        system: studioSystem(ctx, route),
        pageContext: studioPageContext(ctx, route),
      };
    }
    case "map-plant": {
      const route =
        ctx.route?.startsWith("/god-mode") || ctx.route?.startsWith("/map")
          ? ctx.route
          : "/god-mode";
      return {
        system: studioSystem(ctx, route),
        pageContext: studioPageContext(ctx, route),
      };
    }
    case "workshop-process": {
      const processName = ctx.processName?.trim() || "Sample process";
      const processContext = ctx.processContext ?? defaultProcessContext(processName);
      return {
        system: buildChatSystemPrompt(processContext),
        pageContext: null,
      };
    }
    case "automation-architect": {
      const processName = ctx.processName?.trim() || "Sample process";
      return {
        system: buildAutomationChatSystemPrompt({
          processName,
          description: "",
          department: "Operations",
          trigger: null,
          inputs: null,
          outputs: null,
          manualSteps: null,
          diagramMermaid: null,
          existingPlan: null,
          existingIntegrations: [],
        }),
        pageContext: null,
      };
    }
    case "diagram-subagent":
      return { system: DIAGRAM_SYSTEM_PROMPT, pageContext: null };
    case "automation-extract":
      return { system: EXTRACTION_SYSTEM, pageContext: null };
    case "automation-deploy": {
      const processName = ctx.processName?.trim() || "Sample process";
      return {
        system: buildCronPrompt(
          {
            name: processName,
            description: "Settings preview sample process",
            trigger: null,
            manualSteps: null,
            diagramMermaid: null,
          },
          {
            summary: "Sample automation plan for prompt preview.",
            recommendedPath: "hermes_cron",
            triggerType: "schedule",
            schedule: "every 1d at 09:00",
            deliveryChannel: null,
            automatableSteps: ["Run daily review"],
            manualSteps: [],
            reasoning: "Preview only — not a real deployment.",
          },
          null,
          null,
        ),
        pageContext: null,
      };
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown prompt pack: ${String(_exhaustive)}`);
    }
  }
}
