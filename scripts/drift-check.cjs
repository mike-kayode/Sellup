require("dotenv").config();
const fs = require("fs");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Set it in .env and re-run.");
  process.exit(2);
}

/**
 * Schema-drift check (Phase 0 safety net).
 *
 * Compares every (table, column) declared in src/db/schema.ts against the
 * live PostgreSQL information_schema. If any declared column is missing from
 * the database, exit non-zero.
 *
 * Rationale: Drizzle SELECTs every declared column, so one missing column
 * breaks a whole table. This script must run against the live DB before a
 * deploy and in CI. It only checks declared->actual (not the reverse), so
 * legacy tables present only in the DB do not cause false positives.
 *
 * Usage: DATABASE_URL=... node scripts/drift-check.cjs
 * npm script:  npm run db:drift
 */

// Parse pgTable("tableName", { ... }) blocks to extract declared column names.
const schema = fs.readFileSync("src/db/schema.ts", "utf8");
const tables = {};

const blockRegex = /pgTable\(\s*"([^"]+)"\s*,\s*\{([\s\S]*?)\n\s*\}/g;
let match;
while ((match = blockRegex.exec(schema))) {
  const tableName = match[1];
  const body = match[2];
  const columns = new Set();
  // Column declarations look like:  name: pgType("column_name", ...)
  const colRegex = /\w+\s*:\s*\w+\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  let cm;
  while ((cm = colRegex.exec(body))) {
    const raw = cm[1];
    const col = raw.slice(1, -1); // strip surrounding quotes
    columns.add(col);
  }
  tables[tableName] = columns;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});

(async () => {
  let failed = false;
  const client = await pool.connect();
  try {
    const tableNames = Object.keys(tables);
    for (const tableName of tableNames) {
      const declaredColumns = tables[tableName];
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      const actualColumns = new Set(rows.map((r) => r.column_name));
      for (const col of declaredColumns) {
        if (!actualColumns.has(col)) {
          console.error(
            `DRIFT: table "${tableName}" is missing column "${col}" (declared in src/db/schema.ts)`
          );
          failed = true;
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  if (failed) {
    console.error(
      "Schema drift detected: apply the drizzle/ SQL migrations or sync src/db/schema.ts with the database."
    );
    process.exit(1);
  }

  console.log(
    `Schema drift check OK: ${Object.keys(tables).length} tables, all declared columns present in the database.`
  );
  process.exit(0);
})().catch((err) => {
  console.error("Drift check error:", err.message);
  process.exit(1);
});
