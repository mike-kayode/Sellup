/**
 * Storefront template (storefront-v1) migration — idempotent.
 *
 * Creates the template registry, draft/published config tables, the
 * rollback-revision table and the preview-token table. Safe to re-run.
 *
 * Usage: npm run db:storefront
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing. Add it to .env first.");
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "..", "drizzle", "0004_storefront_v1.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  // drizzle SQL files split statements with this marker.
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    for (const statement of statements) {
      await pool.query(statement);
    }
    const check = await pool.query(
      `SELECT to_regclass('public.store_configs') AS t`
    );
    console.log(
      check.rows[0].t
        ? "storefront-v1 tables present: OK"
        : "storefront-v1 tables missing — migration did not apply."
    );
    console.log("storefront-v1 migration complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});