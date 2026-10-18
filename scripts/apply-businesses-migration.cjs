/**
 * Idempotent Phase 1 migration: rename `stores` -> `businesses` and add the
 * `business_type` column. Safe to run multiple times and safe against a DB
 * that has already been migrated (via drizzle-kit migrate or manually).
 *
 * Usage: npm run db:phase1
 */
require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing. Add it to .env first.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    const stores = await pool.query(`SELECT to_regclass('public.stores') AS t`);
    const businesses = await pool.query(`SELECT to_regclass('public.businesses') AS t`);

    if (!stores.rows[0].t && !businesses.rows[0].t) {
      console.log('Neither "stores" nor "businesses" exists yet.');
      console.log("Run the base migrations first (npm run db:migrate), then re-run this script.");
      return;
    }

    if (stores.rows[0].t) {
      await pool.query(`ALTER TABLE "stores" RENAME TO "businesses"`);
      console.log('Renamed table "stores" -> "businesses".');
    } else {
      console.log('Table already named "businesses" — rename not needed.');
    }

    const col = await pool.query(
      `SELECT to_regcolumn('public.businesses.business_type') AS c`
    );
    if (!col.rows[0].c) {
      await pool.query(
        `ALTER TABLE "businesses" ADD COLUMN "business_type" varchar(20) DEFAULT 'product' NOT NULL`
      );
      console.log("Added column business_type.");
    } else {
      console.log("Column business_type already present.");
    }

    console.log("Phase 1 businesses migration complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
