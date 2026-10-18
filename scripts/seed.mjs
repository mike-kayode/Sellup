import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { plans } from "../src/db/schema.ts";

const PLANS = [
  {
    name: "Freemium",
    slug: "freemium",
    description: "Best to start",
    price: 0,
    yearlyPrice: 0,
    currency: "NGN",
    interval: "month",
    productLimit: 5,
    staffLimit: 1,
    storageLimit: "1GB",
    features: ["5 Products", "1 Store Admin", "Basic Theme", "WhatsApp Orders", "Store URL", "Platform Branding", "Basic Analytics"],
    isActive: true,
    isRecommended: false,
    sortOrder: 0,
  },
  {
    name: "Starter",
    slug: "starter",
    description: "For growing businesses",
    price: 5000,
    yearlyPrice: 50000,
    currency: "NGN",
    interval: "month",
    productLimit: 20,
    staffLimit: 1,
    storageLimit: "5GB",
    features: ["20 Products", "Product Listing Template", "Remove Sell Up Branding", "Custom Theme Colors", "Categories", "SEO Settings", "Priority Support"],
    isActive: true,
    isRecommended: true,
    sortOrder: 1,
  },
  {
    name: "Business",
    slug: "business",
    description: "For busy stores",
    price: 12000,
    yearlyPrice: 120000,
    currency: "NGN",
    interval: "month",
    productLimit: -1,
    staffLimit: 5,
    storageLimit: "20GB",
    features: ["Unlimited Products", "Everything in Starter", "Multiple Staff (up to 5)", "Inventory Tracking", "Coupon Codes", "Custom Domain", "Advanced Analytics"],
    isActive: true,
    isRecommended: false,
    sortOrder: 2,
  },
  {
    name: "Custom",
    slug: "pro",
    description: "Tailored to your business — contact us for pricing",
    price: 0,
    yearlyPrice: 0,
    currency: "NGN",
    interval: "month",
    productLimit: -1,
    staffLimit: -1,
    storageLimit: "Unlimited",
    features: ["Unlimited Products", "Everything in Business", "Unlimited Staff", "API Access", "White Label", "Dedicated Support"],
    isActive: true,
    isRecommended: false,
    sortOrder: 3,
  },
];

async function seed() {
  console.log("Seeding plans...");
  for (const plan of PLANS) {
    const { slug, ...values } = plan;
    await db
      .insert(plans)
      .values({ slug, ...values })
      .onConflictDoUpdate({ target: plans.slug, set: values });
    console.log(`Seeded plan: ${plan.name}`);
  }

  // Ensure the store product-listing template column exists (idempotent).
  // The regular drizzle migration also adds this; this guard keeps older
  // databases in sync even if migrations were skipped.
  await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS template varchar(50) DEFAULT 'basic'`);
  console.log("Ensured businesses.template column");

  // Signup verification codes table (idempotent guard for databases that
  // skipped drizzle migrations).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      code_hash varchar(64) NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("Ensured email_verifications table");

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
