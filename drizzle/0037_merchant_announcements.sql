-- Merchant announcement dismissals and bounded active announcement lookups.
-- Idempotent and compatible with PostgreSQL 13.

CREATE TABLE IF NOT EXISTS "announcement_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "announcement_id" uuid NOT NULL REFERENCES "public"."announcements"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "dismissed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "announcement_dismissals_announcement_user_unique" UNIQUE ("announcement_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "announcement_dismissals_store_dismissed_idx"
  ON "announcement_dismissals" USING btree ("store_id", "dismissed_at");

CREATE INDEX IF NOT EXISTS "announcements_target_schedule_idx"
  ON "announcements" USING btree ("target", "scheduled_at", "expires_at");
