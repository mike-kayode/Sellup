-- Track reserved and completed platform subscription promotion redemptions.
-- Reservations older than 24 hours are ignored by checkout availability checks.
-- Idempotent and compatible with PostgreSQL 13.

CREATE TABLE IF NOT EXISTS "platform_promotion_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "promotion_id" uuid NOT NULL REFERENCES "public"."platform_promotions"("id") ON DELETE RESTRICT,
  "payment_id" uuid NOT NULL REFERENCES "public"."payments"("id") ON DELETE RESTRICT,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "discount_amount" numeric(12, 2) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "reserved_at" timestamp with time zone NOT NULL DEFAULT now(),
  "redeemed_at" timestamp with time zone,
  CONSTRAINT "platform_promotion_redemptions_payment_unique" UNIQUE ("payment_id")
);

CREATE INDEX IF NOT EXISTS "platform_promotion_redemptions_promotion_status_idx"
  ON "platform_promotion_redemptions" USING btree ("promotion_id", "status");

CREATE INDEX IF NOT EXISTS "platform_promotion_redemptions_store_status_idx"
  ON "platform_promotion_redemptions" USING btree ("store_id", "status");
