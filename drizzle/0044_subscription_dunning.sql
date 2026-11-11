-- Persist bounded subscription renewal retries.
-- Safe to apply more than once on PostgreSQL 13.

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "dunning_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dunning_next_attempt_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "dunning_locked_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "dunning_last_error" text;

CREATE INDEX IF NOT EXISTS "subscriptions_dunning_due_idx"
  ON "subscriptions" ("status", "dunning_next_attempt_at");
