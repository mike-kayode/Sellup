-- Phase 7: Delivery — shipping zones and rates.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0025_shipping.sql

CREATE TABLE IF NOT EXISTS "shipping_zones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL,
  "description" text,
  "countries" jsonb NOT NULL DEFAULT '[]'::jsonb, -- ISO country codes
  "states" jsonb NOT NULL DEFAULT '[]'::jsonb, -- state/region names
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipping_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "zone_id" uuid NOT NULL REFERENCES "public"."shipping_zones"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL, -- e.g. "Standard", "Express", "Pickup"
  "type" varchar(30) NOT NULL DEFAULT 'flat_rate', -- flat_rate | weight_based | price_based | free | pickup
  "price" decimal(12, 2) NOT NULL DEFAULT '0',
  "min_order_amount" decimal(12, 2),
  "max_order_amount" decimal(12, 2),
  "min_weight" decimal(10, 2),
  "max_weight" decimal(10, 2),
  "estimated_days_min" integer,
  "estimated_days_max" integer,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipping_zones_store_id_idx" ON "shipping_zones" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "shipping_rates_zone_id_idx" ON "shipping_rates" USING btree ("zone_id");

-- Rollback note: DROP INDEX ...; DROP TABLE shipping_rates; DROP TABLE shipping_zones.
