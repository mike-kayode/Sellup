/**
 * Tenant isolation helpers.
 *
 * Every tenant-aware query must verify:
 *   authenticatedUser -> business membership -> resource ownership -> operation
 *
 * Never trust a `storeId`/`businessId` supplied directly by the frontend.
 * Resolve ownership from the authenticated session and membership lookups.
 */
import { NextRequest } from "next/server";
import { db } from "@/db";
import { stores, staffMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Resolve the authenticated user id from a request.
 * For Supabase, the JWT is validated by Supabase Auth; we read the
 * `Authorization: Bearer <token>` header or the `user_id` set by middleware.
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  // If a previous middleware/route already resolved the user id
  const resolved = request.headers.get("x-user-id");
  if (resolved) return resolved;

  // Fall back to the Supabase JWT subject claim (parse without verifying).
  // In production, verify with the Supabase JWT secret via a middleware.
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString()
      );
      if (payload.sub) return payload.sub;
    } catch {
      // ignore malformed token
    }
  }
  return null;
}

/**
 * Verify that a user is the owner of a store (or the store owner).
 */
export async function isStoreOwner(
  userId: string,
  storeId: string
): Promise<boolean> {
  const result = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.userId, userId)))
    .limit(1);
  return result.length > 0;
}

/**
 * Verify that a user is a member (owner or staff) of a store.
 */
export async function isStoreMember(
  userId: string,
  storeId: string
): Promise<boolean> {
  // Owner?
  if (await isStoreOwner(userId, storeId)) return true;

  // Staff member?
  const store = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (store.length === 0) return false;

  const staff = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.storeId, storeId),
        eq(staffMembers.email, userId)
      )
    )
    .limit(1);
  return staff.length > 0;
}

/**
 * Strict ownership guard: returns true if the user owns the store.
 * Throws nothing; returns false otherwise.
 */
export async function requireStoreOwner(
  userId: string,
  storeId: string
): Promise<boolean> {
  return isStoreOwner(userId, storeId);
}
