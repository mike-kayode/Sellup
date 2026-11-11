import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, orders } from "@/db/schema";
import { count, sum, eq, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/stores
 * Admin-only: list all stores with owner, plan, orders and revenue.
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const storeList = await db
      .select({
        id: stores.id,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
        plan: stores.plan,
        isPublished: stores.isPublished,
        userId: stores.userId,
        createdAt: stores.createdAt,
      })
      .from(stores)
      .orderBy(desc(stores.createdAt))
      .limit(200);

    // Owner names
    const userIds = storeList.map((s) => s.userId);
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

    // Orders + revenue per store
    const result = [];
    for (const store of storeList) {
      const orderAgg = await db
        .select({ total: count(), revenue: sum(orders.total) })
        .from(orders)
        .where(eq(orders.storeId, store.id));
      const owner = ownerMap.get(store.userId);
      result.push({
        id: store.id,
        name: store.storeName,
        slug: store.storeSlug,
        plan: store.plan,
        isPublished: store.isPublished,
        owner: owner?.fullName || "Unknown",
        ownerEmail: owner?.email || "",
        orders: orderAgg[0]?.total ?? 0,
        revenue: parseInt(orderAgg[0]?.revenue || "0"),
        createdAt: store.createdAt,
        status: store.isPublished ? "active" : "inactive",
      });
    }

    return NextResponse.json({ stores: result }, { status: 200 });
  } catch (error) {
    console.error("Admin stores error:", error);
    return NextResponse.json(
      { error: "Failed to load stores" },
      { status: 500 }
    );
  }
}
