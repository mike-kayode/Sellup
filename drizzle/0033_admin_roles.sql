-- Persist admin role permissions while preserving the existing built-in role grants.
-- Apply before deploying code that reads admin_roles.

CREATE TABLE IF NOT EXISTS "admin_roles" (
  "id" varchar(50) PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admin_roles_active_idx"
  ON "admin_roles" USING btree ("is_active");

INSERT INTO "admin_roles" ("id", "name", "description", "permissions", "is_system")
VALUES
  ('superadmin', 'Superadmin', 'Full platform access', '["dashboard.read","businesses.read","businesses.manage","users.read","users.manage","orders.read","orders.manage","products.read","products.manage","subscriptions.read","subscriptions.manage","plans.read","plans.manage","payments.read","payments.manage","promotions.read","promotions.manage","support.read","support.manage","content.read","content.manage","domains.read","domains.manage","integrations.read","integrations.manage","features.read","features.manage","staff.read","staff.manage","roles.read","roles.manage","audit_logs.read","security.read","security.manage","system.read","system.manage"]'::jsonb, true),
  ('admin', 'Admin', 'Platform administration', '["dashboard.read","businesses.read","businesses.manage","users.read","users.manage","orders.read","orders.manage","products.read","products.manage","subscriptions.read","subscriptions.manage","plans.read","plans.manage","payments.read","payments.manage","promotions.read","promotions.manage","support.read","support.manage","content.read","content.manage","domains.read","domains.manage","integrations.read","integrations.manage","features.read","features.manage","staff.read","staff.manage","audit_logs.read","security.read","system.read"]'::jsonb, true),
  ('platform_admin', 'Platform Admin', 'Platform operations', '["dashboard.read","businesses.read","businesses.manage","users.read","users.manage","orders.read","subscriptions.read","plans.read","payments.read","support.read","support.manage","content.read","content.manage","staff.read","audit_logs.read","system.read"]'::jsonb, true),
  ('support_agent', 'Support Agent', 'Customer and merchant support', '["dashboard.read","businesses.read","users.read","orders.read","support.read","support.manage","audit_logs.read"]'::jsonb, true),
  ('finance_manager', 'Finance Manager', 'Subscription and payment operations', '["dashboard.read","businesses.read","users.read","subscriptions.read","plans.read","payments.read","payments.manage","audit_logs.read"]'::jsonb, true),
  ('content_manager', 'Content Manager', 'Platform content management', '["dashboard.read","content.read","content.manage","support.read","audit_logs.read"]'::jsonb, true),
  ('moderator', 'Moderator', 'Product and support moderation', '["dashboard.read","businesses.read","products.read","products.manage","orders.read","support.read","support.manage","audit_logs.read"]'::jsonb, true),
  ('developer', 'Developer', 'System and integrations read access', '["dashboard.read","system.read","integrations.read","audit_logs.read"]'::jsonb, true),
  ('analyst', 'Analyst', 'Read-only platform reporting', '["dashboard.read","businesses.read","users.read","orders.read","subscriptions.read","payments.read","audit_logs.read"]'::jsonb, true)
ON CONFLICT ("id") DO NOTHING;
