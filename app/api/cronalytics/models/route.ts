import { NextRequest, NextResponse } from "next/server";
import { computeModels } from "@/lib/cronalytics/aggregations";
import { parseFilters } from "@/lib/cronalytics/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    return NextResponse.json(computeModels(filters));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "models failed" },
      { status: 500 },
    );
  }
}
