-- Phase 3: Suppliers and purchase orders.
-- Purchase orders raise stock (and cost) when received.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0017_suppliers_purchase_orders.sql

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "contact_name" varchar(255),
  "phone" varchar(20),
  "email" varchar(255),
  "address" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "supplier_id" uuid NOT NULL REFERENCES "public"."suppliers"("id") ON DELETE cascade,
  "po_number" varchar(100) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'draft', -- draft | sent | partially_received | received | cancelled
  "location_id" uuid REFERENCES "public"."inventory_locations"("id") ON DELETE set null,
  "expected_date" timestamp with time zone,
  "received_date" timestamp with time zone,
  "total_cost" numeric(12, 2) NOT NULL DEFAULT '0',
  "notes" text,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "purchase_orders_store_id_po_number_unique" UNIQUE ("store_id", "po_number")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "purchase_order_id" uuid NOT NULL REFERENCES "public"."purchase_orders"("id") ON DELETE cascade,
  "variant_id" uuid NOT NULL REFERENCES "public"."product_variants"("id") ON DELETE cascade,
  "quantity_ordered" integer NOT NULL DEFAULT 0,
  "quantity_received" integer NOT NULL DEFAULT 0,
  "unit_cost" numeric(12, 2) NOT NULL DEFAULT '0'
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'suppliers_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "suppliers"
      ADD CONSTRAINT "suppliers_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_orders_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "purchase_orders"
      ADD CONSTRAINT "purchase_orders_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_store_id_idx" ON "suppliers" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_store_id_idx" ON "purchase_orders" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");
CREATE INDEX IF NOT EXISTS "purchase_order_items_po_id_idx" ON "purchase_order_items" USING btree ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "purchase_order_items_variant_id_idx" ON "purchase_order_items" USING btree ("variant_id");

-- Rollback note: DROP INDEX ...; DROP TABLE purchase_order_items; DROP TABLE purchase_orders; DROP TABLE suppliers.
