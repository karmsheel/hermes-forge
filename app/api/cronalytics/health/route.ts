import { NextResponse } from "next/server";
import { getFactDbPath, getStateDbPath, getJobsJsonPath, getHermesHome, probeHermes } from "@/lib/cronalytics/paths";
import { countCronRuns, factDbExists, readWatermark } from "@/lib/cronalytics/db";
import { getSchemaVersionSafe } from "@/lib/cronalytics/aggregations";
import type { HealthResponse } from "@/lib/cronalytics/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<HealthResponse | { ok: false; error: string }>> {
  const probe = probeHermes();
  let cronRunCount = 0;
  let sync = null;
  let dbExists = false;
  let schema = 0;

  try {
    dbExists = factDbExists();
    if (dbExists) {
      cronRunCount = countCronRuns();
      sync = readWatermark();
      schema = getSchemaVersionSafe();
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to read fact DB",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    fact_db_path: getFactDbPath(),
    hermes_home: getHermesHome(),
    hermes_state_db: getStateDbPath(),
    hermes_jobs_json: getJobsJsonPath(),
    hermes_reachable: probe.ok,
    hermes_error: probe.ok ? null : probe.error ?? null,
    fact_db_exists: dbExists,
    cron_run_count: cronRunCount,
    sync,
    schema_version: schema,
  });
}
