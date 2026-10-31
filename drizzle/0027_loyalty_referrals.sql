-- Phase 7: Growth tools — loyalty points and referrals.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0027_loyalty_referrals.sql

CREATE TABLE IF NOT EXISTS "loyalty_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE cascade,
  "points" integer NOT NULL DEFAULT 0, -- positive = earned, negative = redeemed
  "reason" varchar(100) NOT NULL, -- purchase | referral_bonus | signup | redeemed | adjustment
  "reference_type" varchar(50),
  "reference_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "referrer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE cascade,
  "referee_id" uuid REFERENCES "public"."customers"("id") ON DELETE set null,
  "referral_code" varchar(50) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending', -- pending | completed | expired
  "reward_points" integer NOT NULL DEFAULT 0,
  "reward_amount" decimal(12, 2) NOT NULL DEFAULT '0',
  "converted_order_id" uuid REFERENCES "public"."orders"("id") ON DELETE set null,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referrals_store_id_referral_code_unique'
  ) THEN
    ALTER TABLE "referrals"
      ADD CONSTRAINT "referrals_store_id_referral_code_unique" UNIQUE ("store_id", "referral_code");
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_points_store_id_idx" ON "loyalty_points" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "loyalty_points_customer_id_idx" ON "loyalty_points" USING btree ("customer_id");
CREATE INDEX IF NOT EXISTS "referrals_store_id_idx" ON "referrals" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "referrals_referrer_id_idx" ON "referrals" USING btree ("referrer_id");
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals" USING btree ("status");

-- Rollback note: DROP INDEX ...; DROP TABLE referrals; DROP TABLE loyalty_points.
