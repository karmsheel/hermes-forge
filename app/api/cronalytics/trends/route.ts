import { NextRequest, NextResponse } from "next/server";
import { computeTrends } from "@/lib/cronalytics/aggregations";
import { parseFilters } from "@/lib/cronalytics/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    return NextResponse.json(computeTrends(filters));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "trends failed" },
      { status: 500 },
    );
  }
}
