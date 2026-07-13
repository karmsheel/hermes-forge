/**
 * Apply 4.12 HITL schema columns/tables if missing (SQLite).
 * Safe to re-run. Targets DATABASE_URL or prisma/dev.db.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

function resolveDbPath() {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const m = env.match(/DATABASE_URL=["']?file:(.+\.db)["']?/);
    if (m) {
      let p = m[1].replace(/^\.\//, '');
      return path.resolve(p);
    }
  } catch {
    // ignore
  }
  return path.resolve('prisma/dev.db');
}

function tableCols(db, table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  } catch {
    return [];
  }
}

function hasTable(db, name) {
  const row = db
    .prepare(
      `SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=?`
    )
    .get(name);
  return Boolean(row);
}

function ensureColumn(db, table, column, ddl) {
  const cols = tableCols(db, table);
  if (cols.includes(column)) {
    console.log(`  ok ${table}.${column}`);
    return;
  }
  db.exec(ddl);
  console.log(`  added ${table}.${column}`);
}

const appData = process.env.APPDATA || '';
const targets = [
  resolveDbPath(),
  path.resolve('prisma/dev.db'),
  path.resolve('prisma/prisma/dev.db'),
  path.join(appData, 'hermes-forge', 'forge.db'),
  path.join(appData, 'Hermes Forge', 'forge.db'),
  path.join(appData, 'Hermes-Forge', 'forge.db'),
  ...process.argv.slice(2).map((p) => path.resolve(p)),
].filter((p, i, arr) => p && fs.existsSync(p) && arr.indexOf(p) === i);

if (targets.length === 0) {
  console.error('No database files found');
  process.exit(1);
}

function fixDb(dbPath) {
  console.log('\nDatabase:', dbPath);
  const db = new DatabaseSync(dbPath);

// Process lifecycle rename
try {
  db.exec(
    `UPDATE "Process" SET "status" = 'draft' WHERE "status" IN ('mapping', 'discovered')`
  );
  db.exec(
    `UPDATE "Process" SET "status" = 'refined' WHERE "status" = 'reviewed'`
  );
  db.exec(
    `UPDATE "Process" SET "status" = 'forged' WHERE "status" = 'approved'`
  );
  console.log('  process statuses normalized');
} catch (e) {
  console.log('  process status update skipped:', e.message);
}

// BusinessDocument lifecycle
if (hasTable(db, 'BusinessDocument')) {
  ensureColumn(
    db,
    'BusinessDocument',
    'lifecycleStatus',
    `ALTER TABLE "BusinessDocument" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft'`
  );
  ensureColumn(
    db,
    'BusinessDocument',
    'forgedAt',
    `ALTER TABLE "BusinessDocument" ADD COLUMN "forgedAt" DATETIME`
  );
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS "BusinessDocument_businessId_lifecycleStatus_idx" ON "BusinessDocument"("businessId", "lifecycleStatus")`
    );
  } catch {
    // ignore
  }
} else {
  console.log('  BusinessDocument table missing — skip doc columns');
}

// BusinessDecision enrichment
if (hasTable(db, 'BusinessDecision')) {
  ensureColumn(
    db,
    'BusinessDecision',
    'kind',
    `ALTER TABLE "BusinessDecision" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'policy'`
  );
  ensureColumn(
    db,
    'BusinessDecision',
    'sourceRequestId',
    `ALTER TABLE "BusinessDecision" ADD COLUMN "sourceRequestId" TEXT`
  );
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS "BusinessDecision_businessId_kind_recordedAt_idx" ON "BusinessDecision"("businessId", "kind", "recordedAt" DESC)`
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS "BusinessDecision_sourceRequestId_idx" ON "BusinessDecision"("sourceRequestId")`
    );
  } catch {
    // ignore
  }
} else {
  console.error('  BusinessDecision table missing!');
}

// DecisionRequest
if (!hasTable(db, 'DecisionRequest')) {
  db.exec(`
CREATE TABLE "DecisionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contextMarkdown" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "proposerKind" TEXT NOT NULL,
    "hermesAgentProfileId" TEXT,
    "conversationId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "relatedEntityName" TEXT,
    "optionsJson" TEXT NOT NULL,
    "proposedActionsJson" TEXT NOT NULL DEFAULT '{}',
    "selectedOptionId" TEXT,
    "redirectMessage" TEXT,
    "resolvedAt" DATETIME,
    "resolvedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DecisionRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DecisionRequest_businessId_status_createdAt_idx" ON "DecisionRequest"("businessId", "status", "createdAt" DESC);
CREATE INDEX "DecisionRequest_businessId_createdAt_idx" ON "DecisionRequest"("businessId", "createdAt" DESC);
CREATE INDEX "DecisionRequest_hermesAgentProfileId_idx" ON "DecisionRequest"("hermesAgentProfileId");
`);
  console.log('  created DecisionRequest');
} else {
  console.log('  ok DecisionRequest table');
}

// Notification
if (!hasTable(db, 'Notification')) {
  db.exec(`
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "decisionRequestId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_businessId_userId_createdAt_idx" ON "Notification"("businessId", "userId", "createdAt" DESC);
CREATE INDEX "Notification_businessId_userId_readAt_idx" ON "Notification"("businessId", "userId", "readAt");
CREATE INDEX "Notification_decisionRequestId_idx" ON "Notification"("decisionRequestId");
`);
  console.log('  created Notification');
} else {
  console.log('  ok Notification table');
}

// Automation agent bind (if missing from earlier migration)
if (hasTable(db, 'Automation')) {
  ensureColumn(
    db,
    'Automation',
    'hermesAgentProfileId',
    `ALTER TABLE "Automation" ADD COLUMN "hermesAgentProfileId" TEXT`
  );
}

// Mark migration applied if _prisma_migrations exists
if (hasTable(db, '_prisma_migrations')) {
  const name = '20260712150000_decisions_hitl';
  const has = db
    .prepare(
      `SELECT 1 AS x FROM "_prisma_migrations" WHERE "migration_name" = ? AND "finished_at" IS NOT NULL`
    )
    .get(name);
  if (!has) {
    const now = Date.now();
    db.prepare(
      `DELETE FROM "_prisma_migrations" WHERE "migration_name" = ?`
    ).run(name);
    db.prepare(
      `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`
    ).run(`fix-hitl-${now}`, 'manual-fix', now, name, now);
    console.log('  marked migration applied:', name);
  } else {
    console.log('  migration already marked:', name);
  }
}

  console.log('  fixed.');
}

for (const t of targets) {
  try {
    fixDb(t);
  } catch (e) {
    console.error('Failed on', t, e.message);
  }
}

console.log('\nDone. Restart the Next.js dev server and try Forge again.');
