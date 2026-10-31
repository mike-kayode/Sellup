-- Phase 7: Invoice line items.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0024_invoice_items.sql

CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "public"."invoices"("id") ON DELETE cascade,
  "product_id" uuid REFERENCES "public"."products"("id") ON DELETE set null,
  "product_name" varchar(255) NOT NULL,
  "description" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price" decimal(12, 2) NOT NULL DEFAULT '0',
  "line_total" decimal(12, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx" ON "invoice_items" USING btree ("product_id");

-- Rollback note: DROP INDEX ...; DROP TABLE invoice_items.
