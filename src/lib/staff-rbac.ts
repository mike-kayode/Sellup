/**
 * Sell Up merchant staff RBAC � Phase 1.
 *
 * Staff roles (scoped to a single store/business):
 *   owner      - full control over the store
 *   manager    - read + manage most resources (no plan/billing)
 *   cashier    - take orders, read products/customers
 *   fulfilment - manage order status, read products
 *   marketer   - manage products, coupons, read customers
 *
 * Permissions are enforced server-side. Never trust a client-supplied role;
 * always look it up from staff_members (tenant-scoped by store_id).
 */

import { db } from "@/db";
import { staffMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type StaffRole = "owner" | "manager" | "cashier" | "fulfilment" | "marketer";

export type StaffPermission =
  | "dashboard.read"
  | "products.read"
  | "products.manage"
  | "orders.read"
  | "orders.manage"
  | "customers.read"
  | "customers.manage"
  | "coupons.read"
  | "coupons.manage"
  | "staff.read"
  | "staff.manage"
  | "settings.read"
  | "settings.manage";

export const STAFF_ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  owner: [
    "dashboard.read",
    "products.read",
    "products.manage",
    "orders.read",
    "orders.manage",
    "customers.read",
    "customers.manage",
    "coupons.read",
    "coupons.manage",
    "staff.read",
    "staff.manage",
    "settings.read",
    "settings.manage",
  ],
  manager: [
    "dashboard.read",
    "products.read",
    "products.manage",
    "orders.read",
    "orders.manage",
    "customers.read",
    "customers.manage",
    "coupons.read",
    "coupons.manage",
    "settings.read",
  ],
  cashier: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "orders.manage",
    "customers.read",
  ],
  fulfilment: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "orders.manage",
  ],
  marketer: [
    "dashboard.read",
    "products.read",
    "products.manage",
    "coupons.read",
    "coupons.manage",
    "customers.read",
  ],
};

export function staffHasPermission(role: string, permission: StaffPermission): boolean {
  const normalized = (role || "").toLowerCase() as StaffRole;
  const perms = STAFF_ROLE_PERMISSIONS[normalized];
  if (!perms) return false;
  return perms.includes(permission);
}

export interface StaffMember {
  id: string;
  storeId: string;
  email: string;
  name: string;
  role: string;
  permissions: StaffPermission[];
  isActive: boolean;
}

/**
 * Look up a staff member for a store (tenant-scoped). Returns null when the
 * staff member does not exist, is inactive, or does not belong to the store.
 * Fail closed.
 */
export async function getStaffMember(
  storeId: string,
  email: string
): Promise<StaffMember | null> {
  const [row] = await db
    .select({
      id: staffMembers.id,
      storeId: staffMembers.storeId,
      email: staffMembers.email,
      name: staffMembers.name,
      role: staffMembers.role,
      permissions: staffMembers.permissions,
      isActive: staffMembers.isActive,
    })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.storeId, storeId),
        eq(staffMembers.email, email.toLowerCase())
      )
    )
    .limit(1);
  if (!row || !row.isActive || !row.role) return null;
  return {
    id: row.id,
    storeId: row.storeId,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    isActive: row.isActive,
  };
}
