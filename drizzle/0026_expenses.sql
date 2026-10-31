-- Phase 7: Finance — expenses, P&L, tax/VAT.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0026_expenses.sql

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "category" varchar(100) NOT NULL, -- inventory | shipping | marketing | rent | utilities | other
  "amount" decimal(12, 2) NOT NULL DEFAULT '0',
  "currency" varchar(10) NOT NULL DEFAULT 'NGN',
  "tax_amount" decimal(12, 2) NOT NULL DEFAULT '0',
  "tax_rate" decimal(5, 4) NOT NULL DEFAULT '0',
  "description" text,
  "receipt_url" varchar(500),
  "expense_date" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_store_id_idx" ON "expenses" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" USING btree ("category");
CREATE INDEX IF NOT EXISTS "expenses_expense_date_idx" ON "expenses" USING btree ("expense_date");

-- Rollback note: DROP INDEX ...; DROP TABLE expenses.
