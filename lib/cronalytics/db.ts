/**
 * Cronalytics — fact DB layer.
 *
 * Owns:
 *   1. The schema for our derived fact DB (cron_runs + sync_watermark).
 *   2. Read-only access to Hermes's state.db for ingestion.
 *   3. Helpers for opening both, parameter binding, etc.
 *
 * Uses node:sqlite (Node 24 built-in). All operations are synchronous.
 *
 * Mirrors cronalytics/facts.py + cronalytics/config.py from the original
 * plugin. We are NOT writing to state.db — only reading it.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { getFactDbPath, getHermesHome, getStateDbPath, probeHermes } from "./paths";
import type { CronRunRow, SyncWatermark } from "./types";

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS cron_runs (
  session_id        TEXT PRIMARY KEY,
  job_id            TEXT NOT NULL,
  run_time          REAL NOT NULL,
  ended_at          REAL,
  duration_seconds  REAL,
  model             TEXT,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens  INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL,
  actual_cost_usd   REAL,
  cost_status       TEXT,
  cost_source       TEXT,
  billing_provider  TEXT,
  api_call_count    INTEGER NOT NULL DEFAULT 0,
  message_count     INTEGER NOT NULL DEFAULT 0,
  tool_call_count   INTEGER NOT NULL DEFAULT 0,
  end_reason        TEXT,
  success           INTEGER,
  job_mode          TEXT NOT NULL DEFAULT 'agent',
  ingested_at       REAL NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_id    ON cron_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_runs_run_time  ON cron_runs(run_time DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_ingested  ON cron_runs(ingested_at);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_mode  ON cron_runs(job_mode);

CREATE TABLE IF NOT EXISTS sync_watermark (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  last_ended_at   REAL NOT NULL,
  last_sync       TEXT NOT NULL,
  rows_synced     INTEGER NOT NULL
);
`;

// Singleton fact DB connection (sync, so safe).
let _factDb: DatabaseSync | null = null;
let _stateDb: DatabaseSync | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(getFactDbPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getFactDb(): DatabaseSync {
  if (_factDb) return _factDb;
  ensureDataDir();
  const dbPath = getFactDbPath();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);

  // Ensure schema_version row exists.
  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined;
  if (!row) {
    db.prepare("INSERT INTO schema_version (version) VALUES ($v)").run({ $v: SCHEMA_VERSION });
  }

  _factDb = db;
  return db;
}

/**
 * Read-only connection to Hermes's state.db. Throws if Hermes isn't
 * reachable — callers should catch and return a clean error to the client.
 */
export function getHermesStateDb(): DatabaseSync {
  if (_stateDb) return _stateDb;
  const probe = probeHermes();
  if (!probe.ok) throw new Error(probe.error ?? "Hermes not reachable");
  // Open in read-only mode using URI.
  const uri = `file:${getStateDbPath(probe.home)}?mode=ro`;
  const db = new DatabaseSync(uri, { readOnly: true });
  _stateDb = db;
  return db;
}

export function closeAll(): void {
  if (_factDb) {
    _factDb.close();
    _factDb = null;
  }
  if (_stateDb) {
    _stateDb.close();
    _stateDb = null;
  }
}

export interface ScanResult {
  inserted: number;
  last_ended_at: number;
  elapsed_ms: number;
}

const INSERT_SQL = `
INSERT OR IGNORE INTO cron_runs (
  session_id, job_id, run_time, ended_at, duration_seconds,
  model, input_tokens, output_tokens, reasoning_tokens,
  cache_read_tokens, cache_write_tokens,
  estimated_cost_usd, actual_cost_usd, cost_status, cost_source, billing_provider,
  api_call_count, message_count, tool_call_count,
  end_reason, success, job_mode
) VALUES (
  $session_id, $job_id, $run_time, $ended_at, $duration_seconds,
  $model, $input_tokens, $output_tokens, $reasoning_tokens,
  $cache_read_tokens, $cache_write_tokens,
  $estimated_cost_usd, $actual_cost_usd, $cost_status, $cost_source, $billing_provider,
  $api_call_count, $message_count, $tool_call_count,
  $end_reason, $success, $job_mode
)
`;

interface StateDbSessionRow {
  id: string;
  job_id: string | null;
  // Hermes doesn't store job_id directly on sessions; we derive it from the
  // session_key which Cron-triggered sessions use the pattern "cron:".
  source: string;
  model: string | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  billing_provider: string | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  cost_status: string | null;
  cost_source: string | null;
  api_call_count: number;
  session_key: string | null;
}

const FETCH_NEW_SESSIONS_SQL = `
SELECT
  id, source, model, started_at, ended_at, end_reason,
  message_count, tool_call_count,
  input_tokens, output_tokens, reasoning_tokens,
  cache_read_tokens, cache_write_tokens,
  billing_provider, estimated_cost_usd, actual_cost_usd,
  cost_status, cost_source, api_call_count, session_key
FROM sessions
WHERE source = 'cron'
  AND ended_at IS NOT NULL
  AND ended_at > $since
ORDER BY ended_at ASC
`;

/**
 * Run a sync: pull new cron sessions from Hermes state.db and insert them
 * into our fact DB. Uses a watermark so this is safe to call repeatedly.
 */
export function scanCronRuns(jobsByName: Map<string, { no_agent: boolean }>): ScanResult {
  const started = Date.now();
  const factDb = getFactDb();
  const stateDb = getHermesStateDb();

  const watermark = readWatermark();
  const since = watermark?.last_ended_at ?? 0;

  const rows = stateDb
    .prepare(FETCH_NEW_SESSIONS_SQL)
    .all({ $since: since }) as StateDbSessionRow[];

  const insert = factDb.prepare(INSERT_SQL);

  let inserted = 0;
  let maxEndedAt = since;

  const tx = factDb.exec.bind(factDb);
  // Use a transaction for performance.
  factDb.exec("BEGIN");
  try {
    for (const row of rows) {
      if (row.ended_at == null) continue;
      // Derive job_id from session_key. Hermes cron sessions use
      // session_key like "cron:<job_id>:<timestamp>" or just "<job_id>".
      const jobId = deriveJobId(row);
      if (!jobId) continue;

      const jobMeta = jobsByName.get(jobId);
      const jobMode: "agent" | "no_agent" = jobMeta?.no_agent ? "no_agent" : "agent";
      const success = computeSuccess(row);

      insert.run({
        $session_id: row.id,
        $job_id: jobId,
        $run_time: row.started_at,
        $ended_at: row.ended_at,
        $duration_seconds:
          row.ended_at != null && row.started_at != null
            ? row.ended_at - row.started_at
            : null,
        $model: row.model,
        $input_tokens: row.input_tokens ?? 0,
        $output_tokens: row.output_tokens ?? 0,
        $reasoning_tokens: row.reasoning_tokens ?? 0,
        $cache_read_tokens: row.cache_read_tokens ?? 0,
        $cache_write_tokens: row.cache_write_tokens ?? 0,
        $estimated_cost_usd: row.estimated_cost_usd,
        $actual_cost_usd: row.actual_cost_usd,
        $cost_status: row.cost_status,
        $cost_source: row.cost_source,
        $billing_provider: row.billing_provider,
        $api_call_count: row.api_call_count ?? 0,
        $message_count: row.message_count ?? 0,
        $tool_call_count: row.tool_call_count ?? 0,
        $end_reason: row.end_reason,
        $success: success,
        $job_mode: jobMode,
      });
      inserted++;
      if (row.ended_at > maxEndedAt) maxEndedAt = row.ended_at;
    }
    writeWatermark({
      last_ended_at: maxEndedAt,
      last_sync: new Date().toISOString(),
      rows_synced: (watermark?.rows_synced ?? 0) + inserted,
    });
    factDb.exec("COMMIT");
  } catch (err) {
    factDb.exec("ROLLBACK");
    throw err;
  }

  // Suppress unused-binding warnings (tx is captured above for clarity; not
  // actually used in this synchronous implementation).
  void tx;

  return { inserted, last_ended_at: maxEndedAt, elapsed_ms: Date.now() - started };
}

function deriveJobId(row: StateDbSessionRow): string | null {
  // Hermes cron session id format (observed): "cron_<12hex_job_id>_<YYYYMMDD>_<HHMMSS>".
  // Example: "cron_c0bad8b91cb8_20260703_084048".
  // session_key is null for cron sessions in this version, so we parse the
  // id directly. Hermes job ids are 12 lowercase hex chars — match greedily
  // for that to be robust to future format tweaks.
  if (row.id) {
    const m = row.id.match(/^cron_([0-9a-f]{12,})(?:_|$)/);
    if (m) return m[1];
  }
  // Fall back to session_key if present.
  const sk = row.session_key;
  if (sk) {
    const m = sk.match(/^cron[_:]([0-9a-f]{12,})(?:[_:]|$)/);
    if (m) return m[1];
    if (/^[a-f0-9]{12,}$/i.test(sk)) return sk;
  }
  return null;
}

function computeSuccess(row: StateDbSessionRow): number | null {
  if (row.ended_at == null) return null;
  const reason = (row.end_reason ?? "").toLowerCase();
  if (!reason) return 1; // ended cleanly with no error reason
  if (
    reason.includes("error") ||
    reason.includes("fail") ||
    reason.includes("crash") ||
    reason.includes("abort") ||
    reason.includes("timeout") ||
    reason.includes("exception")
  ) {
    return 0;
  }
  return 1;
}

export function readWatermark(): SyncWatermark | null {
  const factDb = getFactDb();
  const row = factDb.prepare("SELECT last_ended_at, last_sync, rows_synced FROM sync_watermark WHERE id = 1").get() as
    | SyncWatermark
    | undefined;
  return row ?? null;
}

export function writeWatermark(w: SyncWatermark): void {
  const factDb = getFactDb();
  factDb
    .prepare(
      `INSERT INTO sync_watermark (id, last_ended_at, last_sync, rows_synced)
       VALUES ($id, $last_ended_at, $last_sync, $rows_synced)
       ON CONFLICT(id) DO UPDATE SET
         last_ended_at = excluded.last_ended_at,
         last_sync = excluded.last_sync,
         rows_synced = excluded.rows_synced`,
    )
    .run({
      $id: 1,
      $last_ended_at: w.last_ended_at,
      $last_sync: w.last_sync,
      $rows_synced: w.rows_synced,
    });
}

export function countCronRuns(): number {
  const factDb = getFactDb();
  const r = factDb.prepare("SELECT COUNT(*) as n FROM cron_runs").get() as { n: number };
  return r.n;
}

export function factDbExists(): boolean {
  return fs.existsSync(getFactDbPath());
}

export function getSchemaVersion(): number {
  const factDb = getFactDb();
  const r = factDb.prepare("SELECT version FROM schema_version LIMIT 1").get() as
    | { version: number }
    | undefined;
  return r?.version ?? 0;
}

export function getHermesHomeSafe(): string {
  return getHermesHome();
}
