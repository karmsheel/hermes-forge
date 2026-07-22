import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import {
  buildPromptPack,
  isPromptPackId,
  type PromptPackId,
} from "@/lib/chatbar/prompt-catalog";
import { redactSecrets } from "@/lib/chatbar/redaction";

/**
 * GET /api/settings/prompt-preview?pack=studio-default&route=/home
 * Builds system (+ optional page context) using the same catalog builders as chat.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const packParam = request.nextUrl.searchParams.get("pack") || "";
    if (!isPromptPackId(packParam)) {
      return NextResponse.json(
        { error: "Unknown or missing pack id" },
        { status: 400 },
      );
    }
    const packId = packParam as PromptPackId;

    const route =
      request.nextUrl.searchParams.get("route")?.trim() || defaultRouteForPack(packId);
    const processName =
      request.nextUrl.searchParams.get("processName")?.trim() || undefined;

    const business = await getActiveBusinessForUser(session.userId, request);
    const businessName = business?.name?.trim() || "Your business";

    const built = buildPromptPack(packId, {
      businessName,
      route,
      mode: "follow-page",
      agent: null,
      processName,
    });

    const systemRedacted = redactSecrets(built.system);
    const pageRedacted = built.pageContext
      ? redactSecrets(built.pageContext)
      : null;

    return NextResponse.json({
      packId,
      route,
      businessName,
      system: systemRedacted.text,
      pageContext: pageRedacted?.text ?? null,
      redactionCount:
        systemRedacted.redactionCount + (pageRedacted?.redactionCount ?? 0),
      disclaimer:
        "Preview uses catalog builders with sample or active-business context. Live chat may inject fuller snapshots, agent persona, and process fields. Secrets are redacted.",
    });
  } catch (error) {
    console.error("prompt-preview error", error);
    return NextResponse.json(
      { error: "Failed to build prompt preview" },
      { status: 500 },
    );
  }
}

function defaultRouteForPack(packId: PromptPackId): string {
  switch (packId) {
    case "foundation":
      return "/foundation";
    case "map-plant":
      return "/god-mode";
    case "workshop-process":
    case "diagram-subagent":
      return "/workshop";
    case "automation-architect":
    case "automation-extract":
    case "automation-deploy":
      return "/automations";
    case "studio-default":
    default:
      return "/home";
  }
}
