require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});
p.query(
  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
)
  .then((r) => {
    console.log("Tables:", r.rows.map((x) => x.tablename).join(", "));
    return p.end();
  })
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
