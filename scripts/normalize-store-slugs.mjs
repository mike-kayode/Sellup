/**
 * Normalize existing store slugs so they carry the business name.
 *
 * Mirrors src/lib/slugs.ts normalizeBusinessSlug + the onboarding
 * deriveSlugFromName padding rule (minimum 3 characters).
 *
 * Usage:
 *   node scripts/normalize-store-slugs.mjs           # dry run (default)
 *   node scripts/normalize-store-slugs.mjs --apply   # write changes
 */
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");

// Reserved first path segments (keep in sync with src/lib/slugs.ts).
const RESERVED = new Set([
  "login", "register", "dashboard", "onboarding", "my-admin", "admin",
  "settings", "support", "staff", "billing", "account", "auth", "superadmin",
  "pricing", "features", "how-it-works", "resources", "demo-store", "about",
  "contact", "help", "terms", "privacy", "blog", "docs", "status", "demo",
  "api", "store", "stores", "products", "checkout", "cart", "orders",
  "customers", "analytics", "coupons", "subscription", "subscriptions",
  "domains", "integrations", "appearance", "pages", "_next", "favicon",
  "robots", "sitemap", "assets", "images", "uploads", "api-docs", "graphql",
  "health", "static", "mail", "www", "app", "try", "proxy", "middleware",
]);

function normalizeBusinessSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

function deriveSlugFromName(name) {
  const base = normalizeBusinessSlug(name);
  if (!base) return "";
  return base.length >= 3 ? base : normalizeBusinessSlug(`${base} store`);
}

function isValid(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) return false;
  if (/--/.test(slug)) return false;
  if (RESERVED.has(slug)) return false;
  return true;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const { rows } = await client.query(
    "SELECT id, store_name, store_slug, is_published FROM stores ORDER BY created_at"
  );

  const currentSlugs = new Set(rows.map((r) => r.store_slug));
  let changes = 0;

  for (const row of rows) {
    const target = deriveSlugFromName(row.store_name || "");
    if (!target || target === row.store_slug) continue;

    if (!isValid(target)) {
      console.log(
        `SKIP  "${row.store_name}" -> "${target}" (reserved/malformed; keeping "${row.store_slug}")`
      );
      continue;
    }
    if (currentSlugs.has(target)) {
      console.log(
        `SKIP  "${row.store_name}" -> "${target}" (taken; keeping "${row.store_slug}")`
      );
      continue;
    }

    changes += 1;
    if (APPLY) {
      await client.query("UPDATE stores SET store_slug = $1, updated_at = now() WHERE id = $2", [
        target,
        row.id,
      ]);
      currentSlugs.delete(row.store_slug);
      currentSlugs.add(target);
      console.log(
        `UPDATE "${row.store_name}": ${row.store_slug} -> ${target} (published=${row.is_published})`
      );
    } else {
      console.log(
        `WOULD "${row.store_name}": ${row.store_slug} -> ${target} (published=${row.is_published})`
      );
    }
  }

  console.log(
    `${APPLY ? "Applied" : "Would apply"} ${changes} change(s) of ${rows.length} store(s).`
  );
  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
