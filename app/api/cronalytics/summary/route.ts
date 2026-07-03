import { NextRequest, NextResponse } from "next/server";
import { computeSummary } from "@/lib/cronalytics/aggregations";
import { parseFilters } from "@/lib/cronalytics/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    return NextResponse.json(computeSummary(filters));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "summary failed" },
      { status: 500 },
    );
  }
}
