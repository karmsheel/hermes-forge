/**
 * Restore business/workflow data from an older SQLite backup into prisma/dev.db,
 * then apply pending Prisma migrations.
 *
 * Usage:
 *   node scripts/restore-from-backup-db.mjs [source-db-path]
 *
 * Default source: dist/desktop/win-unpacked/resources/standalone/prisma/dev.db
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const sourceRel =
  process.argv[2] || 'dist/desktop/win-unpacked/resources/standalone/prisma/dev.db';
const source = path.resolve(root, sourceRel);
const target = path.join(root, 'prisma', 'dev.db');
const targetBackup = path.join(
  root,
  'prisma',
  `dev.db.before-restore-${Date.now()}`
);

/** Prisma CLI resolves file: URLs relative to prisma/ — use absolute path. */
const databaseUrl = `file:${target.replace(/\\/g, '/')}`;

function counts(dbPath) {
  const db = new DatabaseSync(dbPath);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  const result = {};
  for (const table of ['User', 'Business', 'Process', 'ChatMessage', 'BusinessEvent']) {
    if (tables.includes(table)) {
      result[table] = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    }
  }
  const processes = tables.includes('Process')
    ? db
        .prepare(
          'SELECT p.name, b.name as business FROM Process p JOIN Business b ON b.id = p.businessId ORDER BY b.name, p.name'
        )
        .all()
    : [];
  db.close();
  return { result, processes };
}

if (!fs.existsSync(source)) {
  console.error(`Source database not found: ${source}`);
  process.exit(1);
}

const before = counts(source);
console.log('Source:', source);
console.log('Before (source):', before.result);
console.log('Workflows:', before.processes.map((p) => `${p.business} :: ${p.name}`).join('\n  '));

if (fs.existsSync(target)) {
  fs.copyFileSync(target, targetBackup);
  console.log('Backed up current DB to:', targetBackup);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('Copied source ->', target);

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
};

console.log('Running prisma migrate deploy on', databaseUrl);
execSync('npx prisma migrate deploy', {
  cwd: root,
  env,
  stdio: 'inherit',
});

try {
  execSync('npx prisma generate', { cwd: root, env, stdio: 'inherit' });
} catch {
  console.warn('prisma generate failed (file lock?). Restart dev server if needed.');
}

const after = counts(target);
console.log('After migrations:', after.result);
console.log('Workflows:', after.processes.map((p) => `${p.business} :: ${p.name}`).join('\n  '));

if (after.result.Process === 0 && before.result.Process > 0) {
  console.error(
    '\nERROR: Processes were lost during migration. Restore the backup file above and report this issue.'
  );
  process.exit(1);
}

console.log('\nDone. Use DATABASE_URL="file:./prisma/dev.db" in .env (Next.js app root).');