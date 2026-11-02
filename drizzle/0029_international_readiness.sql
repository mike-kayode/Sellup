-- Phase 9: International readiness
-- Per-store currency, country, timezone, locale; tax/VAT settings; exchange rates.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0029_international_readiness.sql

-- Add currency, timezone, locale to businesses.
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "currency" varchar(10) DEFAULT 'NGN' NOT NULL;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "timezone" varchar(100) DEFAULT 'Africa/Lagos' NOT NULL;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "locale" varchar(10) DEFAULT 'en' NOT NULL;

-- Tax/VAT settings per store.
CREATE TABLE IF NOT EXISTS "tax_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "tax_name" varchar(50) NOT NULL DEFAULT 'VAT',
  "tax_rate" decimal(5, 4) NOT NULL DEFAULT '0.0000', -- e.g. 0.0750 for 7.5%
  "tax_registered" boolean NOT NULL DEFAULT false,
  "tax_number" varchar(100),
  "tax_country" varchar(10) NOT NULL DEFAULT 'NG',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tax_settings_store_id_unique" UNIQUE ("store_id")
);

-- Exchange rates for multi-currency display.
CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "from_currency" varchar(10) NOT NULL,
  "to_currency" varchar(10) NOT NULL,
  "rate" decimal(20, 10) NOT NULL DEFAULT '1.0000000000',
  "source" varchar(50) NOT NULL DEFAULT 'manual',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exchange_rates_store_from_to_unique" UNIQUE ("store_id", "from_currency", "to_currency")
);

-- Indexes.
CREATE INDEX IF NOT EXISTS "businesses_currency_idx" ON "businesses" USING btree ("currency");
CREATE INDEX IF NOT EXISTS "businesses_timezone_idx" ON "businesses" USING btree ("timezone");
CREATE INDEX IF NOT EXISTS "businesses_locale_idx" ON "businesses" USING btree ("locale");
CREATE INDEX IF NOT EXISTS "tax_settings_store_id_idx" ON "tax_settings" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "exchange_rates_store_id_idx" ON "exchange_rates" USING btree ("store_id");

-- Rollback note:
-- ALTER TABLE businesses DROP COLUMN currency, DROP COLUMN timezone, DROP COLUMN locale;
-- DROP TABLE tax_settings; DROP TABLE exchange_rates;

