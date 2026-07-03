import { NextRequest, NextResponse } from "next/server";
import { computeRunsForJob } from "@/lib/cronalytics/aggregations";
import { parseFilters } from "@/lib/cronalytics/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const filters = parseFilters(req.nextUrl.searchParams);
    return NextResponse.json(computeRunsForJob(id, filters));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "runs failed" },
      { status: 500 },
    );
  }
}
