/**
 * Cronalytics — scanner wrapper.
 *
 * Higher-level entry point used by the API routes. Combines jobs.json
 * loading and the actual fact-DB ingestion from state.db.
 */
import { buildNoAgentMap } from "./jobs";
import { scanCronRuns, type ScanResult } from "./db";

/**
 * Run a sync: pull new cron sessions from Hermes and write them to the
 * fact DB. Idempotent (uses a watermark).
 */
export function runSync(): ScanResult {
  const jobsByName = buildNoAgentMap();
  return scanCronRuns(jobsByName);
}
