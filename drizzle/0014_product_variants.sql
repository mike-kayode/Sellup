-- Phase 3: Product variants (SKU, barcode, cost, price) per store.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0014_product_variants.sql

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE cascade,
  "sku" varchar(100),
  "barcode" varchar(100),
  "name" varchar(255) NOT NULL,
  "cost_price" numeric(12, 2),
  "price" numeric(12, 2) NOT NULL,
  "stock" integer NOT NULL DEFAULT 0,
  "weight_grams" integer,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "product_variants_store_id_sku_unique" UNIQUE ("store_id", "sku"),
  CONSTRAINT "product_variants_store_id_barcode_unique" UNIQUE ("store_id", "barcode")
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_product_id_products_id_fk'
  ) THEN
    ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_store_id_idx" ON "product_variants" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "product_variants_sku_idx" ON "product_variants" USING btree ("sku");
CREATE INDEX IF NOT EXISTS "product_variants_barcode_idx" ON "product_variants" USING btree ("barcode");
CREATE INDEX IF NOT EXISTS "product_variants_is_active_idx" ON "product_variants" USING btree ("is_active");

-- Rollback note: DROP INDEX ...; DROP TABLE product_variants.
