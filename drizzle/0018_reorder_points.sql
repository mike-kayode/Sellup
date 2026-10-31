-- Phase 3: Reorder points and low-stock alerts.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0018_reorder_points.sql

CREATE TABLE IF NOT EXISTS "reorder_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "variant_id" uuid NOT NULL REFERENCES "public"."product_variants"("id") ON DELETE cascade,
  "location_id" uuid NOT NULL REFERENCES "public"."inventory_locations"("id") ON DELETE cascade,
  "reorder_point" integer NOT NULL DEFAULT 0,
  "reorder_quantity" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "reorder_points_variant_id_location_id_unique" UNIQUE ("variant_id", "location_id")
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reorder_points_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "reorder_points"
      ADD CONSTRAINT "reorder_points_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reorder_points_store_id_idx" ON "reorder_points" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "reorder_points_variant_id_idx" ON "reorder_points" USING btree ("variant_id");

-- Rollback note: DROP INDEX ...; DROP TABLE reorder_points.
