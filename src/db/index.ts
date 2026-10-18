import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Sell Up database client.
 *
 * Works with Supabase-managed PostgreSQL via the DATABASE_URL connection
 * string (use the Supabase "Session pooler" or direct connection string in
 * production, and the transaction pooler for serverless/edge contexts).
 *
 * The pool is created lazily on first use so that builds and client-side
 * bundles never fail when DATABASE_URL is not present (e.g. during `next build`
 * prerendering of purely client pages).
 */

const databaseUrl = process.env.DATABASE_URL;

function createPool(): Pool {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Add it to your .env file using your Supabase Postgres connection string."
    );
  }

  // For Supabase pooler, the username is `postgres.<project-ref>` and the
  // host is `aws-0-<region>.pooler.supabase.com`. `pg` handles it natively.
  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: databaseUrl.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

const globalForDb = globalThis as typeof globalThis & {
  __sellupPool?: Pool;
};

export const pool = globalForDb.__sellupPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sellupPool = pool;
}

export const db = drizzle(pool);

/**
 * Simple health check that tries to run a trivial query.
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Database ping failed:", err);
    return false;
  }
}
