-- Phase 3: Multi-location inventory.
-- Stock locations per store (warehouse, shop, pop-up, ...).
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0013_inventory_locations.sql

CREATE TABLE IF NOT EXISTS "inventory_locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL,
  "address" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_locations_store_id_idx" ON "inventory_locations" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "inventory_locations_default_idx" ON "inventory_locations" USING btree ("store_id", "is_default");

-- Rollback note: DROP INDEX ...; DROP TABLE inventory_locations.
