-- Add merchant delivery preferences and a retryable announcement delivery log.
-- Safe to apply more than once on PostgreSQL 13.

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "announcement_email_opt_out" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "announcement_whatsapp_opt_out" boolean NOT NULL DEFAULT false;

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "send_email" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "send_whatsapp" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "announcement_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "announcement_id" uuid NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "channel" varchar(20) NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
  "last_error" text,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "announcement_deliveries_channel_check"
    CHECK ("channel" IN ('email', 'whatsapp'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_deliveries_announcement_store_channel_unique"
  ON "announcement_deliveries" ("announcement_id", "store_id", "channel");
CREATE INDEX IF NOT EXISTS "announcement_deliveries_status_next_attempt_idx"
  ON "announcement_deliveries" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "announcement_deliveries_announcement_created_idx"
  ON "announcement_deliveries" ("announcement_id", "created_at");
CREATE INDEX IF NOT EXISTS "announcement_deliveries_store_created_idx"
  ON "announcement_deliveries" ("store_id", "created_at");
