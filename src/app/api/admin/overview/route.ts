import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, orders, products, subscriptions, payments } from "@/db/schema";
import { count, sum, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const [userCount, storeCount, orderCount, productCount, activeSubscriptionCount, failedPaymentCount] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(stores),
      db.select({ total: count() }).from(orders),
      db.select({ total: count() }).from(products),
      db.select({ total: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
      db.select({ total: count() }).from(payments).where(eq(payments.status, "failed")),
    ]);

    const revenueAgg = await db.select({ total: sum(orders.total) }).from(orders);
    const activeStoreAgg = await db.select({ total: count() }).from(stores).where(eq(stores.isPublished, true));
    const suspendedStoreAgg = await db.select({ total: count() }).from(stores).where(eq(stores.isPublished, false));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ordersTodayAgg = await db
      .select({ total: count() })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${today}`);

    const freeUsersAgg = await db.select({ total: count() }).from(stores).where(eq(stores.plan, "freemium"));

    return NextResponse.json(
      {
        stats: {
          totalUsers: userCount[0]?.total ?? 0,
          totalStores: storeCount[0]?.total ?? 0,
          totalOrders: orderCount[0]?.total ?? 0,
          totalProducts: productCount[0]?.total ?? 0,
          totalRevenue: parseInt(revenueAgg[0]?.total || "0"),
          activeStores: activeStoreAgg[0]?.total ?? 0,
          suspendedStores: suspendedStoreAgg[0]?.total ?? 0,
          ordersToday: ordersTodayAgg[0]?.total ?? 0,
          freeUsers: freeUsersAgg[0]?.total ?? 0,
          activeSubscriptions: activeSubscriptionCount[0]?.total ?? 0,
          failedPayments: failedPaymentCount[0]?.total ?? 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json(
      { error: "Failed to load admin overview" },
      { status: 500 }
    );
  }
}
