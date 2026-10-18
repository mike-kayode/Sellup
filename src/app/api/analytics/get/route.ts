import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { analytics, analyticsEvents, orders, customers, products, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuthenticatedUser(request);
    if (error) return error;

    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json(
        { error: "storeId is required" },
        { status: 400 }
      );
    }

    const [ownedStore] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (!ownedStore || ownedStore.id !== storeId) {
      return NextResponse.json({ error: "You do not have access to this store" }, { status: 403 });
    }

    const [storeOwner] = await db
      .select({ userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (!storeOwner || storeOwner.userId !== user!.id) {
      return NextResponse.json({ error: "You do not have access to this store" }, { status: 403 });
    }

    // Get daily aggregate analytics and event-level funnel data.
    const analyticsData = await db
      .select()
      .from(analytics)
      .where(eq(analytics.storeId, storeId));

    // Get order stats
    const allOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.storeId, storeId));

    // Get customer stats
    const customersData = await db
      .select()
      .from(customers)
      .where(eq(customers.storeId, storeId));

    // Get product stats
    const productsData = await db
      .select()
      .from(products)
      .where(eq(products.storeId, storeId));

    const eventData = await db
      .select({ eventName: analyticsEvents.eventName })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.storeId, storeId));
    const eventCounts = eventData.reduce<Record<string, number>>((counts, event) => {
      counts[event.eventName] = (counts[event.eventName] || 0) + 1;
      return counts;
    }, {});

    // Calculate totals
    const totalRevenue = allOrders.reduce(
      (sum, order) => sum + parseFloat(order.total),
      0
    );
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(
      (o) => o.status === "completed"
    ).length;
    const totalCustomers = customersData.length;
    const totalProducts = productsData.length;

    // Get top products
    const productOrderMap: Record<string, number> = {};
    allOrders.forEach((order) => {
      const items = order.items as any[];
      if (Array.isArray(items)) {
        items.forEach((item) => {
          productOrderMap[item.productId] =
            (productOrderMap[item.productId] || 0) + item.quantity;
        });
      }
    });

    const topProducts = Object.entries(productOrderMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return NextResponse.json(
      {
        summary: {
          totalOrders,
          completedOrders,
          totalRevenue,
          totalCustomers,
          totalProducts,
          conversionRate:
            totalCustomers > 0
              ? ((completedOrders / totalCustomers) * 100).toFixed(2)
              : "0",
          averageOrderValue:
            totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0",
          eventCounts,
        },
        analytics: analyticsData,
        topProducts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error getting analytics:", error);
    return NextResponse.json(
      { error: "Failed to get analytics" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
