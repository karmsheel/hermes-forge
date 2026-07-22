import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listHermesSessionMessages } from "@/lib/hermes-sessions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    const baseUrl = request.nextUrl.searchParams.get("baseUrl");
    const apiKey = request.nextUrl.searchParams.get("apiKey");
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "Missing baseUrl or apiKey" },
        { status: 400 },
      );
    }

    const result = await listHermesSessionMessages(baseUrl, apiKey, id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Hermes session messages error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load session messages",
      },
      { status: 502 },
    );
  }
}
