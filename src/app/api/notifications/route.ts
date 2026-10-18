import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores } from "@/db/schema";
import { and, eq, gt, inArray, desc } from "drizzle-orm";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuthenticatedUser(request);
    if (error) return error;

    const sinceValue = request.nextUrl.searchParams.get("since");
    const since = sinceValue ? new Date(sinceValue) : new Date(Date.now() - 60_000);
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: "Invalid since timestamp" }, { status: 400 });
    }

    const ownedStores = await db.select({ id: stores.id, storeName: stores.storeName })
      .from(stores).where(eq(stores.userId, user!.id));
    const storeIds = ownedStores.map((store) => store.id);
    if (storeIds.length === 0) return NextResponse.json({ notifications: [] });

    const storeNames = new Map(ownedStores.map((store) => [store.id, store.storeName]));
    const recentOrders = await db.select({
      id: orders.id,
      storeId: orders.storeId,
      orderNumber: orders.orderNumber,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    }).from(orders).where(and(
      inArray(orders.storeId, storeIds),
      gt(orders.updatedAt, since)
    )).orderBy(desc(orders.updatedAt)).limit(25);

    return NextResponse.json({
      notifications: recentOrders.map((order) => ({
        id: `${order.id}:${order.updatedAt.toISOString()}`,
        orderId: order.id,
        storeId: order.storeId,
        title: order.createdAt > since ? "New order received" : "Order updated",
        message: `#${order.orderNumber} at ${storeNames.get(order.storeId) || "your store"} · ₦${Number(order.total).toLocaleString("en-NG")}`,
        critical: ["cancelled", "failed"].includes(order.status || ""),
        status: order.status,
        updatedAt: order.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Merchant notifications error:", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Use GET method" }, { status: 405 });
}
