import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, users, orders } from "@/db/schema";
import { count, sum, eq, desc, inArray, and, ilike } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const plan = url.searchParams.get("plan") || "all";
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    if (search) filters.push(ilike(stores.storeName, `%${search}%`));
    if (plan !== "all") filters.push(eq(stores.plan, plan));
    if (status === "active") filters.push(eq(stores.isPublished, true));
    if (status === "inactive") filters.push(eq(stores.isPublished, false));

    const where = filters.length ? and(...filters) : undefined;
    const query = db.select({
      id: stores.id,
      storeName: stores.storeName,
      storeSlug: stores.storeSlug,
      plan: stores.plan,
      isPublished: stores.isPublished,
      userId: stores.userId,
      createdAt: stores.createdAt,
    }).from(stores);

    const totalAgg = await db.select({ total: count() }).from(stores).where(where);
    const storeList = await query.where(where).orderBy(desc(stores.createdAt)).limit(limit).offset(offset);

    const userIds = storeList.map((s) => s.userId);
    const ownerRows = userIds.length
      ? await db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(inArray(users.id, userIds))
      : [];

    const ownerMap = new Map<string, { fullName: string; email: string }>();
    for (const row of ownerRows) {
      ownerMap.set(row.id, { fullName: row.fullName, email: row.email });
    }

    const result = [];
    for (const store of storeList) {
      const orderAgg = await db.select({ total: count(), revenue: sum(orders.total) }).from(orders).where(eq(orders.storeId, store.id));
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

    return NextResponse.json({
      stores: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin businesses error:", error);
    return NextResponse.json({ error: "Failed to load businesses" }, { status: 500 });
  }
}
