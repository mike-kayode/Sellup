-- Add bounded announcement fan-out progress and delivery leases.
-- Safe to apply more than once on PostgreSQL 13.

ALTER TABLE "announcement_deliveries"
  ADD COLUMN IF NOT EXISTS "locked_at" timestamptz;

CREATE INDEX IF NOT EXISTS "announcement_deliveries_status_locked_idx"
  ON "announcement_deliveries" ("status", "locked_at");

CREATE TABLE IF NOT EXISTS "announcement_delivery_progress" (
  "announcement_id" uuid PRIMARY KEY REFERENCES "announcements"("id") ON DELETE CASCADE,
  "last_store_id" uuid,
  "is_complete" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "announcement_delivery_progress_complete_updated_idx"
  ON "announcement_delivery_progress" ("is_complete", "updated_at");
