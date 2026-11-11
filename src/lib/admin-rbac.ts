export type Permission =
  | "dashboard.read"
  | "businesses.read"
  | "businesses.manage"
  | "users.read"
  | "users.manage"
  | "orders.read"
  | "orders.manage"
  | "products.read"
  | "products.manage"
  | "subscriptions.read"
  | "subscriptions.manage"
  | "plans.read"
  | "plans.manage"
  | "payments.read"
  | "payments.manage"
  | "promotions.read"
  | "promotions.manage"
  | "support.read"
  | "support.manage"
  | "content.read"
  | "content.manage"
  | "domains.read"
  | "domains.manage"
  | "integrations.read"
  | "integrations.manage"
  | "features.read"
  | "features.manage"
  | "staff.read"
  | "staff.manage"
  | "roles.read"
  | "roles.manage"
  | "audit_logs.read"
  | "security.read"
  | "security.manage"
  | "system.read"
  | "system.manage";

export type RoleId = "superadmin" | "admin" | "platform_admin" | "support_agent" | "finance_manager" | "content_manager" | "moderator" | "developer" | "analyst";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.read",
  "businesses.read",
  "businesses.manage",
  "users.read",
  "users.manage",
  "orders.read",
  "orders.manage",
  "products.read",
  "products.manage",
  "subscriptions.read",
  "subscriptions.manage",
  "plans.read",
  "plans.manage",
  "payments.read",
  "payments.manage",
  "promotions.read",
  "promotions.manage",
  "support.read",
  "support.manage",
  "content.read",
  "content.manage",
  "domains.read",
  "domains.manage",
  "integrations.read",
  "integrations.manage",
  "features.read",
  "features.manage",
  "staff.read",
  "staff.manage",
  "roles.read",
  "roles.manage",
  "audit_logs.read",
  "security.read",
  "security.manage",
  "system.read",
  "system.manage",
];

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  superadmin: [
    "dashboard.read",
    "businesses.read",
    "businesses.manage",
    "users.read",
    "users.manage",
    "orders.read",
    "orders.manage",
    "products.read",
    "products.manage",
    "subscriptions.read",
    "subscriptions.manage",
    "plans.read",
    "plans.manage",
    "payments.read",
    "payments.manage",
    "promotions.read",
    "promotions.manage",
    "support.read",
    "support.manage",
    "content.read",
    "content.manage",
    "domains.read",
    "domains.manage",
    "integrations.read",
    "integrations.manage",
    "features.read",
    "features.manage",
    "staff.read",
    "staff.manage",
    "roles.read",
    "roles.manage",
    "audit_logs.read",
    "security.read",
    "security.manage",
    "system.read",
    "system.manage",
  ],
  admin: [
    "dashboard.read",
    "businesses.read",
    "businesses.manage",
    "users.read",
    "users.manage",
    "orders.read",
    "orders.manage",
    "products.read",
    "products.manage",
    "subscriptions.read",
    "subscriptions.manage",
    "plans.read",
    "plans.manage",
    "payments.read",
    "payments.manage",
    "promotions.read",
    "promotions.manage",
    "support.read",
    "support.manage",
    "content.read",
    "content.manage",
    "domains.read",
    "domains.manage",
    "integrations.read",
    "integrations.manage",
    "features.read",
    "features.manage",
    "staff.read",
    "staff.manage",
    "audit_logs.read",
    "security.read",
    "system.read",
  ],
  platform_admin: [
    "dashboard.read",
    "businesses.read",
    "businesses.manage",
    "users.read",
    "users.manage",
    "orders.read",
    "subscriptions.read",
    "plans.read",
    "payments.read",
    "support.read",
    "support.manage",
    "content.read",
    "content.manage",
    "staff.read",
    "audit_logs.read",
    "system.read",
  ],
  support_agent: [
    "dashboard.read",
    "businesses.read",
    "users.read",
    "orders.read",
    "support.read",
    "support.manage",
    "audit_logs.read",
  ],
  finance_manager: [
    "dashboard.read",
    "businesses.read",
    "users.read",
    "subscriptions.read",
    "plans.read",
    "payments.read",
    "payments.manage",
    "audit_logs.read",
  ],
  content_manager: [
    "dashboard.read",
    "content.read",
    "content.manage",
    "support.read",
    "audit_logs.read",
  ],
  moderator: [
    "dashboard.read",
    "businesses.read",
    "products.read",
    "products.manage",
    "orders.read",
    "support.read",
    "support.manage",
    "audit_logs.read",
  ],
  developer: [
    "dashboard.read",
    "system.read",
    "integrations.read",
    "audit_logs.read",
  ],
  analyst: [
    "dashboard.read",
    "businesses.read",
    "users.read",
    "orders.read",
    "subscriptions.read",
    "payments.read",
    "audit_logs.read",
  ],
};

export function hasPermission(
  role: string,
  permission: Permission,
  storedPermissions?: readonly string[]
): boolean {
  if (storedPermissions) {
    return storedPermissions.includes(permission);
  }
  const normalizedRole = role.toLowerCase() as RoleId;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getRolePermissions(role: string): Permission[] {
  const normalizedRole = role.toLowerCase() as RoleId;
  return ROLE_PERMISSIONS[normalizedRole] || [];
}
