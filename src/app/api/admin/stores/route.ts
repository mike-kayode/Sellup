import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, orders } from "@/db/schema";
import { count, sum, eq, desc, inArray } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/stores
 * Admin-only: list all stores with owner, plan, orders and revenue.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

// Resolve admin role: prefer the app `users` table role, but fall back
    // to the Supabase user_metadata.role if the table is unavailable.
    let role: string | null = null;
    try {
      const adminCheck = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      role = adminCheck[0]?.role ?? null;
    } catch (err) {
      console.warn(
        "[admin/stores] users table unavailable, using user_metadata.role"
      );
    }

    if (role !== "admin" && role !== "superadmin") {
      const metaRole = user.user_metadata?.role as string | undefined;
      if (metaRole !== "admin" && metaRole !== "superadmin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
