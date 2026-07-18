import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { ensureOverlordHired } from "@/lib/overlord/lazy-hire";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }
    const agent = await ensureOverlordHired(business.id, session.userId);
    if (!agent) {
      return NextResponse.json(
        { error: "No Forge Overlord set", code: "no_overlord" },
        { status: 400 },
      );
    }
    return NextResponse.json({ agent });
  } catch (e) {
    console.error("ensure-hired", e);
    return NextResponse.json({ error: "Failed to ensure Overlord hire" }, { status: 500 });
  }
}
