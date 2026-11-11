-- Admin support queue indexes and threaded support replies.
-- Idempotent and compatible with PostgreSQL 13.

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE,
  "actor_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "is_internal" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_created_idx"
  ON "support_ticket_messages" USING btree ("ticket_id", "created_at");
CREATE INDEX IF NOT EXISTS "support_ticket_messages_actor_idx"
  ON "support_ticket_messages" USING btree ("actor_id");
CREATE INDEX IF NOT EXISTS "support_tickets_status_created_idx"
  ON "support_tickets" USING btree ("status", "created_at");
CREATE INDEX IF NOT EXISTS "support_tickets_subject_lower_idx"
  ON "support_tickets" USING btree (lower("subject"));
