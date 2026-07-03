import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/cronalytics/scanner";
import { closeAll, getFactDb } from "@/lib/cronalytics/db";
import { probeHermes } from "@/lib/cronalytics/paths";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

export async function POST(req: NextRequest) {
  const probe = probeHermes();
  if (!probe.ok) {
    return NextResponse.json(
      { ok: false, error: probe.error ?? "Hermes not reachable" },
      { status: 503 },
    );
  }
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("reset") === "true") {
      // Wipe the fact DB and re-ingest from scratch. Used to recover from
      // schema or job_id-derivation bugs.
      const db = getFactDb();
      db.exec("DELETE FROM cron_runs");
      db.exec("DELETE FROM sync_watermark");
      closeAll();
    }
    const result = runSync();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}
