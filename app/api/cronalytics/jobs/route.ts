import { NextRequest, NextResponse } from "next/server";
import { computeJobs } from "@/lib/cronalytics/aggregations";
import { parseFilters } from "@/lib/cronalytics/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    return NextResponse.json(computeJobs(filters));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "jobs failed" },
      { status: 500 },
    );
  }
}
