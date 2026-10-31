-- Phase 3: Stock levels per variant per location.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0015_stock_levels.sql

CREATE TABLE IF NOT EXISTS "stock_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "variant_id" uuid NOT NULL REFERENCES "public"."product_variants"("id") ON DELETE cascade,
  "location_id" uuid NOT NULL REFERENCES "public"."inventory_locations"("id") ON DELETE cascade,
  "quantity" integer NOT NULL DEFAULT 0,
  "reserved" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stock_levels_variant_id_location_id_unique" UNIQUE ("variant_id", "location_id")
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_levels_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "stock_levels"
      ADD CONSTRAINT "stock_levels_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_levels_store_id_idx" ON "stock_levels" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "stock_levels_variant_id_idx" ON "stock_levels" USING btree ("variant_id");
CREATE INDEX IF NOT EXISTS "stock_levels_location_id_idx" ON "stock_levels" USING btree ("location_id");

-- Rollback note: DROP INDEX ...; DROP TABLE stock_levels.
