-- Phase 7: Sales operations — Invoices, quotes and receipts.
-- Branded PDF documents with payment links; proof-of-payment upload;
-- deposits and part-payments.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0023_invoices.sql

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE cascade,
  "order_id" uuid REFERENCES "public"."orders"("id") ON DELETE set null,
  "invoice_number" varchar(50) NOT NULL,
  "type" varchar(20) NOT NULL DEFAULT 'invoice', -- invoice | quote | receipt
  "status" varchar(20) NOT NULL DEFAULT 'draft', -- draft | sent | paid | partial | void | overdue
  "subtotal" decimal(12, 2) NOT NULL DEFAULT '0',
  "tax" decimal(12, 2) NOT NULL DEFAULT '0',
  "discount" decimal(12, 2) NOT NULL DEFAULT '0',
  "total" decimal(12, 2) NOT NULL DEFAULT '0',
  "amount_paid" decimal(12, 2) NOT NULL DEFAULT '0',
  "currency" varchar(10) NOT NULL DEFAULT 'NGN',
  "due_date" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "pdf_url" varchar(500),
  "payment_link" varchar(500),
  "proof_of_payment_url" varchar(500),
  "notes" text,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "invoices_store_id_invoice_number_unique" UNIQUE ("store_id", "invoice_number")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_store_id_idx" ON "invoices" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "invoices_customer_id_idx" ON "invoices" USING btree ("customer_id");
CREATE INDEX IF NOT EXISTS "invoices_order_id_idx" ON "invoices" USING btree ("order_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");
CREATE INDEX IF NOT EXISTS "invoices_type_idx" ON "invoices" USING btree ("type");
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices" USING btree ("created_at");

-- Rollback note: DROP INDEX ...; DROP TABLE invoices.
