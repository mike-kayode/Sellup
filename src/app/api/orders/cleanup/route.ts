import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { analyticsEvents, orders, products } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";

const ABANDONED_ORDER_HOURS = 24;

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret || request.headers.get("x-cron-secret") !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - ABANDONED_ORDER_HOURS * 60 * 60 * 1000);
    const abandonedOrders = await db.select({ id: orders.id, storeId: orders.storeId, items: orders.items })
      .from(orders).where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)));
    let released = 0;

    for (const order of abandonedOrders) {
      await db.transaction(async (tx) => {
        const [current] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, order.id)).limit(1);
        if (!current || current.status !== "pending") return;
        const items = Array.isArray(order.items) ? order.items as Array<{ productId: string; quantity: number }> : [];
        for (const item of items) {
          await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() })
            .where(and(eq(products.id, item.productId), sql`${products.stock} is not null`));
        }
        await tx.update(orders).set({ status: "cancelled", paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, order.id));
        await tx.insert(analyticsEvents).values({ storeId: order.storeId, orderId: order.id, eventName: "ORDER_CANCELLED", metadata: { reason: "abandoned" } });
        released++;
      });
    }

    return NextResponse.json({ success: true, released });
  } catch (error) {
    console.error("Order cleanup error:", error);
    return NextResponse.json({ error: "Failed to clean up abandoned orders" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}