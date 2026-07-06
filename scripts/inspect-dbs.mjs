import { DatabaseSync } from 'node:sqlite';

const paths = [
  'dev.db',
  'prisma/dev.db',
  'dist/desktop/win-unpacked/resources/standalone/prisma/dev.db',
];

for (const dbPath of paths) {
  try {
    const db = new DatabaseSync(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name)
      .filter((t) => !t.startsWith('_'));

    const beCols = tables.includes('BusinessEvent')
      ? db.prepare('PRAGMA table_info(BusinessEvent)').all().map((c) => c.name)
      : [];

    const bizCols = tables.includes('Business')
      ? db.prepare('PRAGMA table_info(Business)').all().map((c) => c.name)
      : [];

    const counts = {};
    for (const t of ['User', 'Business', 'Process', 'ChatMessage', 'BusinessEvent', 'Memory']) {
      if (tables.includes(t)) {
        counts[t] = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
      }
    }

    console.log(JSON.stringify({ dbPath, tables, beCols, bizCols, counts }, null, 2));
    db.close();
  } catch (e) {
    console.log(JSON.stringify({ dbPath, error: e.message }));
  }
}