#!/usr/bin/env node
/**
 * Sell Up - Admin Account Provisioner
 *
 * Creates a Supabase Auth user, syncs it into the `users` table, and sets
 * the role to `superadmin` so they can access the /admin portal.
 *
 * Usage:
 *   node scripts/create-admin.mjs
 *
 * Requires the following in your .env (loaded automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("Missing required env vars:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error("  - DATABASE_URL");
  process.exit(1);
}

// Admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@nefxbietech.com.ng";
const ADMIN_NAME = process.env.ADMIN_NAME || "Sell Up Admin";
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || generatePassword();

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const db = drizzle(pool);

  console.log("Creating admin user...");

  // 1. Create user in Supabase Auth (idempotent-ish: catch duplicate email)
  let userId;
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME, role: "superadmin" },
  });

  if (error) {
    if (
      error.status === 409 ||
      error.message?.toLowerCase().includes("already")
    ) {
      console.log(`User ${ADMIN_EMAIL} already exists. Fetching existing user...`);
      const {
        data: { users: existing },
        error: listErr,
      } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const found = existing.find((u) => u.email === ADMIN_EMAIL);
      if (!found) throw new Error("Could not find existing admin user");
      userId = found.id;
      console.log("Existing user found. Updating password to the generated one.");
      await supabase.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        user_metadata: { full_name: ADMIN_NAME, role: "superadmin" },
      });
    } else {
      throw error;
    }
  } else {
    userId = data.user.id;
  }

  // 2. Upsert the application account and its separate platform membership.
  try {
    const existing = await db.execute(
      `SELECT id FROM users WHERE email = $1`,
      [ADMIN_EMAIL]
    );

    if (existing.rows.length > 0) {
      await db.execute(
        `UPDATE users SET role = 'superadmin', full_name = $2, is_email_verified = true, is_active = true WHERE id = $1`,
        [userId, ADMIN_NAME]
      );
      console.log("Updated existing user record -> role = superadmin");
    } else {
      await db.execute(
        `INSERT INTO users (id, email, password, full_name, is_email_verified, is_active, role)
         VALUES ($1, $2, '', $3, true, true, 'superadmin')`,
        [userId, ADMIN_EMAIL, ADMIN_NAME]
      );
      console.log("Inserted admin user record -> role = superadmin");
    }
    await db.execute(
      `INSERT INTO admin_memberships (user_id, role, is_active)
       VALUES ($1, 'superadmin', true)
       ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin', is_active = true, updated_at = now()`,
      [userId]
    );
    console.log("Ensured active superadmin membership");
} catch (dbErr) {
    console.warn(
      "[create-admin] Could not write to users table (DB unreachable?). The Supabase Auth user is still created.",
      dbErr && dbErr.message ? dbErr.message : String(dbErr)
    );
  } finally {
    await pool.end().catch(() => {});
  }

  console.log("\n==========================================");
  console.log("  ADMIN ACCOUNT CREATED SUCCESSFULLY");
  console.log("==========================================");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  Login:    /login`);
  console.log(`  Dashboard:/admin`);
  console.log("==========================================");
}

main().catch((err) => {
  console.error("Failed to create admin:", err.message || err);
  process.exit(1);
});
