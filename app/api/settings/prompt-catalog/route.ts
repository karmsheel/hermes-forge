import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listPromptCatalog } from "@/lib/chatbar/prompt-catalog";

/**
 * GET /api/settings/prompt-catalog
 * Metadata for Settings → Agent prompts (no built prompt text).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    return NextResponse.json({ packs: listPromptCatalog() });
  } catch (error) {
    console.error("prompt-catalog error", error);
    return NextResponse.json(
      { error: "Failed to load prompt catalog" },
      { status: 500 },
    );
  }
}
