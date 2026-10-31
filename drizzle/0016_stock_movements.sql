-- Phase 3: Append-only stock ledger.
-- Every stock change writes exactly one row here in the same transaction as
-- the stock change. Never change stock without a ledger row.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0016_stock_movements.sql

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "variant_id" uuid NOT NULL REFERENCES "public"."product_variants"("id") ON DELETE cascade,
  "location_id" uuid REFERENCES "public"."inventory_locations"("id") ON DELETE set null,
  "type" varchar(30) NOT NULL, -- sale | return | purchase | adjustment | transfer_in | transfer_out | damage | reservation
  "quantity" integer NOT NULL, -- signed delta for the location/variant
  "reference_type" varchar(30), -- order | purchase_order | adjustment | transfer | manual
  "reference_id" uuid,
  "reason" text,
  "notes" text,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_movements_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_store_id_idx" ON "stock_movements" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "stock_movements_variant_id_idx" ON "stock_movements" USING btree ("variant_id");
CREATE INDEX IF NOT EXISTS "stock_movements_location_id_idx" ON "stock_movements" USING btree ("location_id");
CREATE INDEX IF NOT EXISTS "stock_movements_type_idx" ON "stock_movements" USING btree ("type");
CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_type", "reference_id");

-- Rollback note: DROP INDEX ...; DROP TABLE stock_movements.
