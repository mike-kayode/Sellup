#!/usr/bin/env node
/**
 * Promote an account to platform superadmin.
 * Usage: node scripts/promote-superadmin.mjs <email>
 *
 * Sets all three layers the app checks:
 *   1. Supabase Auth user_metadata.role = "superadmin" (login redirect + admin layout)
 *   2. users.role = 'superadmin', verified + active     (/api/auth/me + requireAdmin)
 *   3. admin_memberships role='superadmin', active      (requireAdmin API gate + RBAC)
 *
 * Existing passwords are NEVER changed. New accounts are created email-confirmed
 * with a generated password printed ONCE.
 *
 * Requires in .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import crypto from "crypto";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../.env") });

// Unbuffered logging: PowerShell pipes can swallow buffered console output.
const log = (...args) => process.stderr.write(args.join(" ") + "\n");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const TARGET_EMAIL = (process.argv[2] || process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();

if (!TARGET_EMAIL) {
  log("Usage: node scripts/promote-superadmin.mjs <email>");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  log("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL");
  process.exit(1);
}

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

// Find a user by email (listUsers is paginated).
async function findAuthUser(supabase, email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = (data.users || []).find((u) => (u.email || "").toLowerCase() === email);
    if (found) return found;
    if (!data.users || data.users.length < perPage) return null;
    page += 1;
  }
}


async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log(`Target: ${TARGET_EMAIL}`);
  log("Looking up auth user...");

  // 1. Supabase Auth metadata
  let userId;
  let generatedPassword = null;
  const existing = await findAuthUser(supabase, TARGET_EMAIL);
  log(existing ? `Found existing auth user ${existing.id}` : "No existing auth user");

  if (existing) {
    userId = existing.id;
    const mergedMeta = { ...(existing.user_metadata || {}), role: "superadmin" };
    const { error } = await supabase.auth.admin.updateUserById(userId, { user_metadata: mergedMeta });
    if (error) throw error;
    log("[auth] set user_metadata.role = superadmin (password unchanged)");
  } else {
    generatedPassword = generatePassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: TARGET_EMAIL,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { role: "superadmin" },
    });
    if (error) throw error;
    userId = data.user.id;
    log("[auth] account did not exist; created with email confirmed");
  }

  // 2 + 3. App tables: users + admin_memberships
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });

  try {
    const existingRows = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (existingRows.rows.length > 0) {
      await pool.query(
        `UPDATE users SET role = 'superadmin', is_email_verified = true, is_active = true WHERE id = $1`,
        [userId]
      );
      log("[db] users row updated -> role=superadmin, active, verified");
    } else {
      await pool.query(
        `INSERT INTO users (id, email, password, full_name, is_email_verified, is_active, role)
         VALUES ($1, $2, '', $3, true, true, 'superadmin')`,
        [userId, TARGET_EMAIL, existing?.user_metadata?.full_name || TARGET_EMAIL]
      );
      log("[db] users row inserted -> role=superadmin");
    }

    await pool.query(
      `INSERT INTO admin_memberships (user_id, role, is_active)
       VALUES ($1, 'superadmin', true)
       ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin', is_active = true, updated_at = now()`,
      [userId]
    );
    log("[db] admin_memberships ensured -> role=superadmin, active");

    // Verify
    const [u, m] = await Promise.all([
      pool.query(`SELECT email, role, is_active, is_email_verified FROM users WHERE id = $1`, [userId]),
      pool.query(`SELECT role, is_active FROM admin_memberships WHERE user_id = $1`, [userId]),
    ]);
    log("==========================================");
    log("  SUPERADMIN PROMOTION VERIFIED");
    log("==========================================");
    log(`  Email:          ${TARGET_EMAIL}`);
    log("  Auth metadata:  role=superadmin");
    log(`  users:          ${JSON.stringify(u.rows[0] ?? null)}`);
    log(`  memberships:    ${JSON.stringify(m.rows[0] ?? null)}`);
    if (generatedPassword) {
      log(`  NEW PASSWORD:   ${generatedPassword}   <-- shown once, save it now`);
    } else {
      log("  Password:       unchanged");
    }
    log("  Login:          /login  ->  /my-admin");
    log("==========================================");
  } catch (dbErr) {
    log("");
    log("[!] Auth promotion succeeded, but DB writes FAILED:",
      dbErr && dbErr.message ? dbErr.message : String(dbErr));
    log("    Re-run this script once the DB is reachable.");
    process.exitCode = 2;
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  log("Failed to promote admin:", err.message || err);
  process.exit(1);
});
