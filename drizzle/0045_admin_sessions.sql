-- Track authenticated admin sessions for visibility and selective revocation.
-- Safe to apply more than once on PostgreSQL 13.

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" varchar(255) NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ip_address" varchar(45),
  "user_agent" text,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admin_sessions_user_last_seen_idx"
  ON "admin_sessions" ("user_id", "last_seen_at");
CREATE INDEX IF NOT EXISTS "admin_sessions_user_created_idx"
  ON "admin_sessions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_sessions_active_expiry_idx"
  ON "admin_sessions" ("revoked_at", "expires_at");
