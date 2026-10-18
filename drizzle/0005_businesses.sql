-- Phase 1: business-centric data model.
-- The storefront entity is now the "business" table, and every business has a
-- business_type: 'product' | 'service' | 'both'.
--
-- Apply with:  npm run db:migrate
-- (or the idempotent helper: npm run db:phase1)
ALTER TABLE "stores" RENAME TO "businesses";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "business_type" varchar(20) DEFAULT 'product' NOT NULL;
