import { NextRequest, NextResponse } from "next/server";
import { requireSession, getActiveBusinessForUser } from "@/lib/auth";
import { buildServerPageSnapshot } from "@/lib/chatbar/page-snapshot-server";
import { pageBlurbForPath } from "@/lib/chatbar/page-registry";

/**
 * GET /api/studio/page-snapshot?route=/home
 * Read-only business/page summary for hermes.forge.context.v1.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const route = request.nextUrl.searchParams.get("route") || "/home";
    const blurb = pageBlurbForPath(route);

    const snapshot = await buildServerPageSnapshot({
      businessId: business.id,
      businessName: business.name,
      route,
    });

    return NextResponse.json({
      protocol: "hermes.forge.context.v1",
      business: { id: business.id, name: business.name },
      page: {
        title: blurb.title,
        purpose: blurb.purpose,
        routeKey: blurb.routeKey,
        uiHints: blurb.uiHints || [],
      },
      snapshot: {
        text: snapshot.text,
        approxChars: snapshot.approxChars,
      },
      redactionCount: snapshot.redactionCount,
    });
  } catch (error) {
    console.error("page-snapshot error", error);
    return NextResponse.json({ error: "Failed to build page snapshot" }, { status: 500 });
  }
}
