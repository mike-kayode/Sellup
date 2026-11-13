import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, businesses, orders } from "@/db/schema";
import { count, sum, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/stores
 * Admin-only: list all stores with owner, plan, orders and revenue.
 *
 * Authorization comes from requireAdmin(), which checks the database roles
 * (users.role and admin_memberships) and fails closed. It must never trust
 * Supabase user_metadata: any signed-in user can edit their own metadata.
 *
 * This is the legacy list used by the old /admin pages. New screens use
 * /api/admin/businesses.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const storeList = await db
      .select({
        id: businesses.id,
        storeName: businesses.storeName,
        storeSlug: businesses.storeSlug,
        plan: businesses.plan,
        isPublished: businesses.isPublished,
        userId: businesses.userId,
        createdAt: businesses.createdAt,
      })
      .from(businesses)
      .orderBy(desc(businesses.createdAt))
      .limit(200);

    const userIds = Array.from(new Set(storeList.map((s) => s.userId)));
    const storeIds = storeList.map((s) => s.id);

    // Owner names
    const ownerRows = userIds.length
      ? await db
          .select({ id: users.id, fullName: users.fullName, email: users.email })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const ownerMap = new Map<string, { fullName: string; email: string }>();
    for (const row of ownerRows) {
      ownerMap.set(row.id, { fullName: row.fullName, email: row.email });
    }

    // Orders and revenue for all listed stores in one grouped query
    const aggRows = storeIds.length
      ? await db
          .select({ storeId: orders.storeId, total: count(), revenue: sum(orders.total) })
          .from(orders)
          .where(inArray(orders.storeId, storeIds))
          .groupBy(orders.storeId)
      : [];
    const aggMap = new Map<string, { total: number; revenue: number }>();
    for (const row of aggRows) {
      aggMap.set(row.storeId, {
        total: Number(row.total) || 0,
        revenue: parseInt(String(row.revenue ?? "0"), 10) || 0,
      });
    }

    const result = storeList.map((store) => {
      const owner = ownerMap.get(store.userId);
      const agg = aggMap.get(store.id);
      return {
        id: store.id,
        name: store.storeName,
        slug: store.storeSlug,
        plan: store.plan,
        isPublished: store.isPublished,
        owner: owner?.fullName || "Unknown",
        ownerEmail: owner?.email || "",
        orders: agg?.total ?? 0,
        revenue: agg?.revenue ?? 0,
        createdAt: store.createdAt,
        status: store.isPublished ? "active" : "inactive",
      };
    });

    return NextResponse.json({ stores: result }, { status: 200 });
  } catch (err) {
    console.error("Admin stores error:", err);
    return NextResponse.json({ error: "Failed to load stores" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
